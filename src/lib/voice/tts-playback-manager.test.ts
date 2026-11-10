import assert from "node:assert/strict";
import test from "node:test";

import { clearBetterAuthJwt } from "../better-auth-token";
import { TtsPlaybackManager } from "./tts-playback-manager";

class FakeAudioBuffer {
  private readonly channels: Float32Array[];

  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.channels = Array.from(
      { length: numberOfChannels },
      () => new Float32Array(length),
    );
  }

  get duration(): number {
    return this.length / this.sampleRate;
  }

  getChannelData(channel: number): Float32Array {
    return this.channels[channel];
  }
}

class FakeAudioBufferSource {
  buffer: FakeAudioBuffer | null = null;
  onended: (() => void) | null = null;
  startedAt: number | null = null;
  stopped = false;

  connect(): void {}

  start(when = 0): void {
    this.startedAt = when;
  }

  stop(): void {
    this.stopped = true;
  }
}

class FakeAudioContext {
  state = "running";
  currentTime = 0;
  destination = {};
  readonly sources: FakeAudioBufferSource[] = [];

  createBuffer(
    numberOfChannels: number,
    length: number,
    sampleRate: number,
  ): FakeAudioBuffer {
    return new FakeAudioBuffer(numberOfChannels, length, sampleRate);
  }

  async decodeAudioData(): Promise<FakeAudioBuffer> {
    return new FakeAudioBuffer(1, 100, 24000);
  }

  createBufferSource(): FakeAudioBufferSource {
    const source = new FakeAudioBufferSource();
    this.sources.push(source);
    return source;
  }

  async resume(): Promise<void> {}

  async close(): Promise<void> {
    this.state = "closed";
  }
}

function installFakeAudio(): { ctx: FakeAudioContext; restore: () => void } {
  const ctx = new FakeAudioContext();
  const globals = globalThis as unknown as {
    window?: { AudioContext?: unknown };
  };
  const originalWindow = globals.window;
  globals.window = {
    AudioContext: function () {
      return ctx;
    },
  };
  return {
    ctx,
    restore: () => {
      if (originalWindow === undefined) {
        delete globals.window;
      } else {
        globals.window = originalWindow;
      }
    },
  };
}

function createJwt(): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 600 }),
  ).toString("base64url");
  return `header.${payload}.signature`;
}

function installFetchAudio(): { ttsPaths: string[]; restore: () => void } {
  clearBetterAuthJwt();
  const token = createJwt();
  const ttsPaths: string[] = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const path = new URL(url, "http://localhost").pathname;

    if (path === "/api/auth/token") {
      return new Response(JSON.stringify({ token }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    ttsPaths.push(path);
    return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 });
  };

  return {
    ttsPaths,
    restore: () => {
      globalThis.fetch = originalFetch;
      clearBetterAuthJwt();
    },
  };
}

function pcmChunkB64(int16Values: number[]): string {
  return Buffer.from(new Int16Array(int16Values).buffer).toString("base64");
}

const PCM_MIME = "audio/pcm;rate=24000";

test("completed realtime stream replays from cache without a network request", async () => {
  const audio = installFakeAudio();
  const net = installFetchAudio();
  try {
    const manager = new TtsPlaybackManager();
    manager.feedRealtimeChunk("cand-1", pcmChunkB64([0, 100, -100]), PCM_MIME, 1);
    manager.feedRealtimeChunk("cand-1", pcmChunkB64([200, -200]), PCM_MIME, 2);
    manager.finishRealtime("cand-1");

    await manager.playMessage("cand-1");

    assert.equal(net.ttsPaths.length, 0);
    assert.equal(manager.getPlayingCandidateId(), "cand-1");
    const source = audio.ctx.sources.at(-1)!;
    assert.notEqual(source.startedAt, null);
    assert.deepEqual(
      Array.from(source.buffer!.getChannelData(0)),
      [0, 100, -100, 200, -200].map((v) => v / 32768),
    );
    manager.dispose();
  } finally {
    net.restore();
    audio.restore();
  }
});

test("manual playback caches the decoded buffer for repeat plays", async () => {
  const audio = installFakeAudio();
  const net = installFetchAudio();
  try {
    const manager = new TtsPlaybackManager();
    await manager.playMessage("cand-2");
    assert.equal(net.ttsPaths.length, 1);
    manager.stopMessage("cand-2");

    await manager.playMessage("cand-2");
    assert.equal(net.ttsPaths.length, 1);
    assert.equal(manager.getPlayingCandidateId(), "cand-2");
    manager.dispose();
  } finally {
    net.restore();
    audio.restore();
  }
});

test("interrupted realtime stream is not cached", async () => {
  const audio = installFakeAudio();
  const net = installFetchAudio();
  try {
    const manager = new TtsPlaybackManager();
    manager.feedRealtimeChunk("cand-3", pcmChunkB64([1, 2, 3]), PCM_MIME, 1);
    manager.interruptAll();
    manager.finishRealtime("cand-3");

    await manager.playMessage("cand-3");

    assert.equal(net.ttsPaths.length, 1);
    manager.dispose();
  } finally {
    net.restore();
    audio.restore();
  }
});

test("stream with a failed chunk is not cached", async () => {
  const audio = installFakeAudio();
  const net = installFetchAudio();
  try {
    const manager = new TtsPlaybackManager();
    manager.feedRealtimeChunk("cand-4", "%%%invalid-base64%%%", PCM_MIME, 1);
    manager.feedRealtimeChunk("cand-4", pcmChunkB64([1, 2, 3]), PCM_MIME, 2);
    manager.finishRealtime("cand-4");

    await manager.playMessage("cand-4");

    assert.equal(net.ttsPaths.length, 1);
    manager.dispose();
  } finally {
    net.restore();
    audio.restore();
  }
});

test("new candidate after an interrupted one is still cached", async () => {
  const audio = installFakeAudio();
  const net = installFetchAudio();
  try {
    const manager = new TtsPlaybackManager();
    manager.feedRealtimeChunk("cand-a", "%%%invalid-base64%%%", PCM_MIME, 1);
    manager.interruptAll();
    manager.feedRealtimeChunk("cand-b", pcmChunkB64([7, 8]), PCM_MIME, 1);
    manager.finishRealtime("cand-b");

    await manager.playMessage("cand-b");

    assert.equal(net.ttsPaths.length, 0);
    assert.equal(manager.getPlayingCandidateId(), "cand-b");
    manager.dispose();
  } finally {
    net.restore();
    audio.restore();
  }
});

test("LRU evicts the least recently used candidate when over capacity", async () => {
  const audio = installFakeAudio();
  const net = installFetchAudio();
  try {
    // Each decoded fake buffer is 100 frames * 1 channel * 4 bytes = 400 bytes.
    const manager = new TtsPlaybackManager({ cacheMaxBytes: 800 });
    await manager.playMessage("cand-a");
    manager.stopMessage("cand-a");
    await manager.playMessage("cand-b");
    manager.stopMessage("cand-b");
    assert.equal(net.ttsPaths.length, 2);

    // Touch A so B becomes the eviction victim, then add C.
    await manager.playMessage("cand-a");
    manager.stopMessage("cand-a");
    assert.equal(net.ttsPaths.length, 2);
    await manager.playMessage("cand-c");
    manager.stopMessage("cand-c");
    assert.equal(net.ttsPaths.length, 3);

    await manager.playMessage("cand-b");
    manager.stopMessage("cand-b");
    assert.equal(net.ttsPaths.length, 4);

    // B's re-fetch evicted A (oldest after touch order); C survives.
    await manager.playMessage("cand-c");
    assert.equal(net.ttsPaths.length, 4);
    manager.stopMessage("cand-c");
    await manager.playMessage("cand-a");
    assert.equal(net.ttsPaths.length, 5);
    manager.dispose();
  } finally {
    net.restore();
    audio.restore();
  }
});
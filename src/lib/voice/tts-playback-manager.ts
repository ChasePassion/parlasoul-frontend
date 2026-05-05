import { getTtsAudioStream } from "@/lib/api";

type PlayStateCallback = (candidateId: string | null) => void;
type AudioReadyCallback = (candidateId: string) => void;

/**
 * TtsPlaybackManager
 *
 * Manages all TTS audio playback:
 * - Realtime streaming (auto read-aloud via SSE tts_audio_delta events)
 * - Single message manual playback (speaker button)
 * - Interrupt rules (mic start, new message sent)
 */
export class TtsPlaybackManager {
  private audioContext: AudioContext | null = null;
  private playingCandidateId: string | null = null;

  // Realtime streaming state
  private realtimeQueue: AudioBuffer[] = [];
  private realtimeQueuedDurationSec = 0;
  private realtimeNextStartTime = 0;
  private realtimeActiveSources: AudioBufferSourceNode[] = [];
  private realtimeCandidateId: string | null = null;
  private realtimeFinished = false;
  private realtimeStarted = false;
  private readonly realtimeStartBufferSec = 1.0;
  private readonly realtimeMinPlayAheadSec = 0.35;

  // Single-message playback state
  private singleSource: AudioBufferSourceNode | null = null;
  private singleAbort: AbortController | null = null;

  // External callback
  onPlayStateChange: PlayStateCallback = () => {};
  onAudioReady: AudioReadyCallback = () => {};

  // ── AudioContext management ──

  private getOrCreateAudioContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === "closed") {
      this.audioContext = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )();
    }
    return this.audioContext;
  }

  /**
   * Must be called after a user interaction to resume AudioContext.
   * Called automatically before any playback operation.
   */
  async ensureResumed(): Promise<void> {
    const ctx = this.getOrCreateAudioContext();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
  }

  // ── Realtime streaming playback (auto read-aloud) ──

  feedRealtimeChunk(
    candidateId: string,
    audioB64: string,
    mimeType: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    seq: number,
  ): void {
    // If a different candidate starts, clear previous
    if (this.realtimeCandidateId && this.realtimeCandidateId !== candidateId) {
      this.stopRealtime();
    }

    this.realtimeCandidateId = candidateId;
    this.realtimeFinished = false;

    try {
      const ctx = this.getOrCreateAudioContext();
      const raw = atob(audioB64);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) {
        bytes[i] = raw.charCodeAt(i);
      }

      let audioBuffer: AudioBuffer;

      if (mimeType.startsWith("audio/pcm")) {
        // Parse sample rate from mime: "audio/pcm;rate=24000"
        const rateMatch = mimeType.match(/rate=(\d+)/);
        const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;

        // PCM 16-bit signed LE → Float32
        const int16 = new Int16Array(bytes.buffer, 0, bytes.length >> 1);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
          float32[i] = int16[i] / 32768;
        }

        audioBuffer = ctx.createBuffer(1, float32.length, sampleRate);
        audioBuffer.getChannelData(0).set(float32);
      } else {
        // For opus/mp3 — cannot decode synchronously; skip for realtime
        // Realtime stream should always be PCM from backend
        console.warn(
          `[TTS] Unexpected mime type for realtime: ${mimeType}, skipping`,
        );
        return;
      }

      this.realtimeQueue.push(audioBuffer);
      this.realtimeQueuedDurationSec += audioBuffer.duration;
      this.scheduleRealtimePlayback(ctx);
    } catch (err) {
      console.warn("[TTS] Failed to decode realtime chunk:", err);
    }
  }

  private scheduleRealtimePlayback(ctx: AudioContext): void {
    // Don't schedule if no queue
    if (this.realtimeQueue.length === 0) return;

    if (!this.realtimeStarted) {
      if (!this.realtimeFinished && this.realtimeQueuedDurationSec < this.realtimeStartBufferSec) {
        return;
      }
      this.realtimeStarted = true;
      if (this.realtimeNextStartTime <= 0) {
        this.realtimeNextStartTime = ctx.currentTime + 0.05;
      }
    }

    // Update playing state
    if (!this.playingCandidateId && this.realtimeCandidateId) {
      this.setPlayingId(this.realtimeCandidateId);
    }

    // Schedule all queued buffers
    while (this.realtimeQueue.length > 0) {
      const buffer = this.realtimeQueue.shift()!;
      this.realtimeQueuedDurationSec = Math.max(
        0,
        this.realtimeQueuedDurationSec - buffer.duration,
      );
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      const startTime = Math.max(
        this.realtimeNextStartTime,
        ctx.currentTime + this.realtimeMinPlayAheadSec,
      );
      source.start(startTime);
      this.realtimeNextStartTime = startTime + buffer.duration;

      this.realtimeActiveSources.push(source);

      source.onended = () => {
        const idx = this.realtimeActiveSources.indexOf(source);
        if (idx !== -1) this.realtimeActiveSources.splice(idx, 1);

        // If realtime is finished and no more sources playing, clear state
        if (
          this.realtimeFinished &&
          this.realtimeActiveSources.length === 0 &&
          this.realtimeQueue.length === 0
        ) {
          this.realtimeCandidateId = null;
          if (this.playingCandidateId && !this.singleSource) {
            this.setPlayingId(null);
          }
        }
      };
    }
  }

  finishRealtime(candidateId: string): void {
    if (this.realtimeCandidateId !== candidateId) return;
    this.realtimeFinished = true;
    this.scheduleRealtimePlayback(this.getOrCreateAudioContext());

    // If nothing is playing and queue is empty, clear immediately
    if (
      this.realtimeActiveSources.length === 0 &&
      this.realtimeQueue.length === 0
    ) {
      this.realtimeCandidateId = null;
      if (this.playingCandidateId === candidateId && !this.singleSource) {
        this.setPlayingId(null);
      }
    }
  }

  handleTtsError(code: string, message: string): void {
    console.warn(`[TTS] Stream error: ${code} — ${message}`);
    // Don't break text chat; just stop realtime playback gracefully
    this.stopRealtime();
  }

  private stopRealtime(): void {
    for (const source of this.realtimeActiveSources) {
      try {
        source.stop();
      } catch {
        // Already stopped
      }
    }
    this.realtimeActiveSources = [];
    this.realtimeQueue = [];
    this.realtimeQueuedDurationSec = 0;
    this.realtimeNextStartTime = 0;
    this.realtimeFinished = false;
    this.realtimeStarted = false;

    const wasCandidateId = this.realtimeCandidateId;
    this.realtimeCandidateId = null;

    if (this.playingCandidateId === wasCandidateId && !this.singleSource) {
      this.setPlayingId(null);
    }
  }

  // ── Single-message manual playback ──

  async playMessage(candidateId: string): Promise<void> {
    // Interrupt everything first
    this.interruptAll();

    await this.ensureResumed();
    const ctx = this.getOrCreateAudioContext();

    const abortController = new AbortController();
    this.singleAbort = abortController;

    try {
      const arrayBuffer = await getTtsAudioStream(candidateId, {
        audio_format: "mp3",
        signal: abortController.signal,
      });

      if (abortController.signal.aborted) return;

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));

      if (abortController.signal.aborted) return;

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      this.singleSource = source;

      source.onended = () => {
        if (this.singleSource === source) {
          this.singleSource = null;
          this.singleAbort = null;
          if (this.playingCandidateId === candidateId) {
            this.setPlayingId(null);
          }
        }
      };

      source.start(0);
      this.setPlayingId(candidateId);
      this.onAudioReady(candidateId);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      console.error("[TTS] Single playback failed:", err);
      this.singleSource = null;
      this.singleAbort = null;
      if (this.playingCandidateId === candidateId) {
        this.setPlayingId(null);
      }
      throw err;
    }
  }

  stopMessage(candidateId: string): void {
    if (this.playingCandidateId !== candidateId) return;

    if (this.singleSource) {
      try {
        this.singleSource.stop();
      } catch {
        // Already stopped
      }
      this.singleSource = null;
    }

    if (this.singleAbort) {
      this.singleAbort.abort();
      this.singleAbort = null;
    }

    this.setPlayingId(null);
  }

  // ── Interrupt ──

  interruptAll(): void {
    // Stop realtime
    this.stopRealtime();

    // Stop single playback
    if (this.singleSource) {
      try {
        this.singleSource.stop();
      } catch {
        // Already stopped
      }
      this.singleSource = null;
    }

    if (this.singleAbort) {
      this.singleAbort.abort();
      this.singleAbort = null;
    }

    this.setPlayingId(null);
  }

  // ── State query ──

  getPlayingCandidateId(): string | null {
    return this.playingCandidateId;
  }

  private setPlayingId(id: string | null): void {
    if (this.playingCandidateId === id) return;
    this.playingCandidateId = id;
    this.onPlayStateChange(id);
  }

  // ── Lifecycle ──

  dispose(): void {
    this.interruptAll();
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(() => {});
    }
    this.audioContext = null;
  }
}

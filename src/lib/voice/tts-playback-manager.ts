import { getTtsAudioStream } from "@/lib/api";
import { logger, Module, TtsEvent } from "@/lib/logger";

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
  private realtimeSeqCounter = 0;
  private readonly realtimeStartBufferSec = 0.35;
  private readonly realtimeMinPlayAheadSec = 0.05;

  // Single-message playback state
  private singleSource: AudioBufferSourceNode | null = null;
  private singleAbort: AbortController | null = null;

  // LRU decoded-audio cache; candidateId is a safe key because candidate content is immutable
  private readonly audioCache = new Map<string, AudioBuffer>();
  private cacheTotalBytes = 0;
  private readonly cacheMaxBytes: number;

  // Realtime chunks are accumulated separately and only cached once the stream completes
  private realtimeRecordChunks: AudioBuffer[] = [];
  private realtimeRecordSampleRate = 24000;
  private realtimeRecordValid = true;

  // External callback
  onPlayStateChange: PlayStateCallback = () => {};
  onAudioReady: AudioReadyCallback = () => {};

  constructor(options?: { cacheMaxBytes?: number }) {
    this.cacheMaxBytes = options?.cacheMaxBytes ?? 48 * 1024 * 1024;
  }

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

  async ensureResumedForRealtime(): Promise<void> {
    try {
      await this.ensureResumed();
    } catch (err) {
      logger.fromError(Module.VOICE, err, TtsEvent.RESUME_FAILED);
    }
  }

  // ── Realtime streaming playback (auto read-aloud) ──

  feedRealtimeChunk(
    candidateId: string,
    audioB64: string,
    mimeType: string,
    seq: number,
  ): void {
    // If a different candidate starts, clear previous
    if (this.realtimeCandidateId && this.realtimeCandidateId !== candidateId) {
      this.stopRealtime();
    }

    this.realtimeCandidateId = candidateId;
    this.realtimeFinished = false;
    this.realtimeSeqCounter++;

    try {
      const ctx = this.getOrCreateAudioContext();
      if (ctx.state === "suspended") {
        void ctx.resume().catch((err) => {
          logger.fromError(Module.VOICE, err, TtsEvent.RESUME_FAILED, { seq });
        });
      }
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
        this.realtimeRecordValid = false;
        logger.warn(Module.VOICE, TtsEvent.MIME_SKIP, "Unexpected mime type for realtime", {
          mime_type: mimeType,
        });
        return;
      }

      if (this.realtimeRecordChunks.length === 0) {
        this.realtimeRecordSampleRate = audioBuffer.sampleRate;
      } else if (audioBuffer.sampleRate !== this.realtimeRecordSampleRate) {
        this.realtimeRecordValid = false;
      }
      if (this.realtimeRecordValid) {
        this.realtimeRecordChunks.push(audioBuffer);
      }

      this.realtimeQueue.push(audioBuffer);
      this.realtimeQueuedDurationSec += audioBuffer.duration;
      this.scheduleRealtimePlayback(ctx);
    } catch (err) {
      this.realtimeRecordValid = false;
      logger.fromError(Module.VOICE, err, TtsEvent.DECODE_FAILED, { seq });
    }
  }

  private scheduleRealtimePlayback(ctx: AudioContext): void {
    // Don't schedule if no queue
    if (this.realtimeQueue.length === 0) return;

    // Snapshot once — ctx.currentTime is stable during synchronous JS execution
    const now = ctx.currentTime;

    if (!this.realtimeStarted) {
      if (!this.realtimeFinished && this.realtimeQueuedDurationSec < this.realtimeStartBufferSec) {
        return;
      }
      this.realtimeStarted = true;
      this.realtimeNextStartTime = now + this.realtimeMinPlayAheadSec;
      logger.info(Module.VOICE, TtsEvent.SCHEDULE_STARTED, "TTS realtime scheduling started", {
        now: now.toFixed(3),
        next_start: this.realtimeNextStartTime.toFixed(3),
        queue_len: this.realtimeQueue.length,
        buffer_ms: Math.round(this.realtimeQueuedDurationSec * 1000),
      });
    }

    // Update playing state
    if (!this.playingCandidateId && this.realtimeCandidateId) {
      this.setPlayingId(this.realtimeCandidateId);
    }

    // Underrun detection: if the timeline fell behind, re-anchor from now
    if (this.realtimeNextStartTime < now + 0.01) {
      logger.warn(Module.VOICE, TtsEvent.UNDERRUN, "TTS underrun detected, re-anchoring timeline", {
        next_start: this.realtimeNextStartTime.toFixed(3),
        now: now.toFixed(3),
      });
      this.realtimeNextStartTime = now + this.realtimeMinPlayAheadSec;
    }

    // Schedule all queued buffers on the continuous timeline
    let scheduled = 0;
    const seqBefore = this.realtimeSeqCounter;
    while (this.realtimeQueue.length > 0) {
      const buffer = this.realtimeQueue.shift()!;
      this.realtimeQueuedDurationSec = Math.max(
        0,
        this.realtimeQueuedDurationSec - buffer.duration,
      );
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      const startTime = this.realtimeNextStartTime;
      source.start(startTime);
      this.realtimeNextStartTime = startTime + buffer.duration;
      scheduled++;

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
          this.realtimeStarted = false;
          this.realtimeNextStartTime = 0;
          if (this.playingCandidateId && !this.singleSource) {
            this.setPlayingId(null);
          }
        }
      };
    }

    logger.info(Module.VOICE, TtsEvent.SCHEDULE_DONE, "TTS scheduling pass complete", {
      scheduled,
      seq_from: seqBefore > 0 ? seqBefore - scheduled + 1 : 0,
      seq_to: seqBefore,
      buffered_ms: Math.round(this.realtimeQueuedDurationSec * 1000),
      queue_remain: this.realtimeQueue.length,
      active_sources: this.realtimeActiveSources.length,
      next_start: this.realtimeNextStartTime.toFixed(3),
    });
  }

  finishRealtime(candidateId: string): void {
    if (this.realtimeCandidateId !== candidateId) return;
    this.realtimeFinished = true;
    this.cacheRealtimeRecording(candidateId);
    logger.info(Module.VOICE, TtsEvent.FINISH, "TTS realtime stream finished", {
      active_sources: this.realtimeActiveSources.length,
      queue_len: this.realtimeQueue.length,
      started: this.realtimeStarted,
      next_start: this.realtimeNextStartTime.toFixed(3),
    });
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
    logger.warn(Module.VOICE, TtsEvent.STREAM_ERROR, "TTS stream error", {
      code,
      error_message: message,
    });
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
    this.realtimeSeqCounter = 0;
    this.realtimeRecordChunks = [];
    this.realtimeRecordValid = true;

    const wasCandidateId = this.realtimeCandidateId;
    this.realtimeCandidateId = null;

    if (this.playingCandidateId === wasCandidateId && !this.singleSource) {
      this.setPlayingId(null);
    }
  }

  private cacheRealtimeRecording(candidateId: string): void {
    const chunks = this.realtimeRecordChunks;
    const valid = this.realtimeRecordValid;
    this.realtimeRecordChunks = [];
    this.realtimeRecordValid = true;
    if (!valid || chunks.length === 0) return;

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = this.getOrCreateAudioContext().createBuffer(
      1,
      totalLength,
      this.realtimeRecordSampleRate,
    );
    const channel = combined.getChannelData(0);
    let offset = 0;
    for (const chunk of chunks) {
      channel.set(chunk.getChannelData(0), offset);
      offset += chunk.length;
    }
    this.cacheSet(candidateId, combined);
  }

  // ── Single-message manual playback ──

  async playMessage(candidateId: string): Promise<void> {
    // Interrupt everything first
    this.interruptAll();

    await this.ensureResumed();
    const ctx = this.getOrCreateAudioContext();

    const cached = this.cacheGet(candidateId);
    if (cached) {
      logger.info(Module.VOICE, TtsEvent.CACHE_HIT, "Playing cached TTS audio", {
        candidate_id: candidateId,
      });
      this.startSingleSource(ctx, candidateId, cached);
      return;
    }

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

      this.cacheSet(candidateId, audioBuffer);
      this.startSingleSource(ctx, candidateId, audioBuffer);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      logger.fromError(Module.VOICE, err, "tts.single_playback_failed", {
        candidate_id: candidateId,
      });
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
    this.stopSinglePlayback();
  }

  private startSingleSource(
    ctx: AudioContext,
    candidateId: string,
    audioBuffer: AudioBuffer,
  ): void {
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
  }

  private stopSinglePlayback(): void {
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

  // ── Audio cache ──

  private cacheGet(candidateId: string): AudioBuffer | null {
    const buffer = this.audioCache.get(candidateId);
    if (!buffer) return null;
    this.audioCache.delete(candidateId);
    this.audioCache.set(candidateId, buffer);
    return buffer;
  }

  private cacheSet(candidateId: string, buffer: AudioBuffer): void {
    const bytes = buffer.length * buffer.numberOfChannels * 4;
    if (bytes > this.cacheMaxBytes) return;

    const existing = this.audioCache.get(candidateId);
    if (existing) {
      this.cacheTotalBytes -= existing.length * existing.numberOfChannels * 4;
      this.audioCache.delete(candidateId);
    }
    this.audioCache.set(candidateId, buffer);
    this.cacheTotalBytes += bytes;

    while (this.cacheTotalBytes > this.cacheMaxBytes) {
      const oldestKey = this.audioCache.keys().next().value;
      if (oldestKey === undefined) break;
      const oldest = this.audioCache.get(oldestKey)!;
      this.audioCache.delete(oldestKey);
      this.cacheTotalBytes -= oldest.length * oldest.numberOfChannels * 4;
    }

    logger.info(Module.VOICE, TtsEvent.CACHE_STORE, "TTS audio cached", {
      candidate_id: candidateId,
      cache_bytes: this.cacheTotalBytes,
    });
  }

  // ── Interrupt ──

  interruptAll(): void {
    // Stop realtime
    this.stopRealtime();
    this.stopSinglePlayback();
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
    this.audioCache.clear();
    this.cacheTotalBytes = 0;
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(() => {});
    }
    this.audioContext = null;
  }
}

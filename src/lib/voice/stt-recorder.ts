import { sttTranscribe } from "@/lib/api";
import { ApiError } from "@/lib/token-store";

export type SttRecorderState = "idle" | "recording" | "transcribing";
export type MicStartErrorCode =
  | "MIC_API_UNAVAILABLE"
  | "MIC_INSECURE_CONTEXT"
  | "MIC_PERMISSION_DENIED"
  | "MIC_DEVICE_NOT_FOUND"
  | "MIC_DEVICE_BUSY"
  | "MIC_CONSTRAINT_UNSUPPORTED"
  | "MIC_START_FAILED";

const TARGET_STT_SAMPLE_RATE = 16000;

/**
 * SttRecorder
 *
 * Manages microphone recording, provides AnalyserNode for waveform
 * visualization, and handles upload + transcription.
 */
export class SttRecorder {
  state: SttRecorderState = "idle";

  // Audio capture
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;

  // Recording
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  // State change callback
  onStateChange: (state: SttRecorderState) => void = () => {};

  private setState(next: SttRecorderState): void {
    this.state = next;
    this.onStateChange(next);
  }

  // ── Recording control ──

  static async getMicPermissionState(): Promise<PermissionState | "unsupported"> {
    if (typeof navigator === "undefined") {
      return "unsupported";
    }
    if (!("permissions" in navigator) || !navigator.permissions?.query) {
      return "unsupported";
    }
    try {
      const status = await navigator.permissions.query({
        name: "microphone" as PermissionName,
      });
      return status.state;
    } catch {
      return "unsupported";
    }
  }

  private mapMicStartError(err: unknown): MicStartErrorCode {
    if (!window.isSecureContext) {
      return "MIC_INSECURE_CONTEXT";
    }

    if (err instanceof DOMException) {
      switch (err.name) {
        case "NotAllowedError":
        case "PermissionDeniedError":
        case "SecurityError":
          return "MIC_PERMISSION_DENIED";
        case "NotFoundError":
        case "DevicesNotFoundError":
          return "MIC_DEVICE_NOT_FOUND";
        case "NotReadableError":
        case "TrackStartError":
          return "MIC_DEVICE_BUSY";
        case "OverconstrainedError":
        case "ConstraintNotSatisfiedError":
          return "MIC_CONSTRAINT_UNSUPPORTED";
        default:
          return "MIC_START_FAILED";
      }
    }

    if (err instanceof TypeError) {
      return "MIC_API_UNAVAILABLE";
    }

    return "MIC_START_FAILED";
  }

  async startRecording(): Promise<void> {
    if (this.state !== "idle") {
      this.cleanup();
    }

    if (!window.isSecureContext) {
      throw new Error("MIC_INSECURE_CONTEXT");
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("MIC_API_UNAVAILABLE");
    }

    // Request microphone
    let mediaStream: MediaStream;
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (err) {
      console.error("[STT] Microphone access error:", err);
      throw new Error(this.mapMicStartError(err));
    }

    this.stream = mediaStream;

    // Create AudioContext for waveform analysis
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    this.audioContext = new AudioCtx();

    // Create analyser for waveform visualization
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 256;
    this.analyser = analyser;

    // Connect source → analyser
    this.source = this.audioContext.createMediaStreamSource(mediaStream);
    this.source.connect(analyser);

    // Setup MediaRecorder
    const mimeType = this.getPreferredMimeType();
    this.chunks = [];

    this.mediaRecorder = new MediaRecorder(mediaStream, {
      mimeType: mimeType || undefined,
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    this.mediaRecorder.start(250); // Collect chunks every 250ms
    this.setState("recording");
  }

  async confirmAndTranscribe(): Promise<string> {
    if (this.state !== "recording" || !this.mediaRecorder) {
      throw new Error("NOT_RECORDING");
    }

    // Stop MediaRecorder and wait for final data
    const blob = await this.stopMediaRecorderAndCollect();

    // Check minimum size (roughly 1KB for very short silence)
    if (blob.size < 500) {
      this.cleanup();
      throw new Error("NO_SPEECH");
    }

    this.setState("transcribing");

    try {
      const uploadBlob = await this.convertBlobToWav16kMono(blob);
      const result = await sttTranscribe(uploadBlob, {
        audio_format: "wav",
        sample_rate: TARGET_STT_SAMPLE_RATE,
      });

      if (!result.text || result.text.trim().length === 0) {
        this.cleanup();
        throw new Error("NO_SPEECH");
      }

      this.cleanup();
      return result.text.trim();
    } catch (err) {
      this.cleanup();

      if (err instanceof Error && err.message === "NO_SPEECH") {
        throw err;
      }

      if (err instanceof ApiError && err.status === 422) {
        throw new Error("NO_SPEECH");
      }

      console.error("[STT] Transcription failed:", err);
      throw new Error("TRANSCRIBE_FAILED");
    }
  }

  cancelRecording(): void {
    this.cleanup();
  }

  // ── Waveform data ──

  getAnalyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  // ── Internal helpers ──

  private getPreferredMimeType(): string {
    // Prefer webm/opus (Chrome/Edge), fallback to others
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ];

    for (const mime of candidates) {
      if (MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    }

    return ""; // Let browser choose default
  }

  private stopMediaRecorderAndCollect(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
        const blob = new Blob(this.chunks, { type: "audio/webm" });
        resolve(blob);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || "audio/webm";
        const blob = new Blob(this.chunks, { type: mimeType });
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  private async convertBlobToWav16kMono(blob: Blob): Promise<Blob> {
    const sourceBuffer = await this.decodeAudioBlob(blob);
    const monoPcm = await this.resampleTo16kMono(sourceBuffer);
    return this.encodeWavPcm16(monoPcm, TARGET_STT_SAMPLE_RATE);
  }

  private async decodeAudioBlob(blob: Blob): Promise<AudioBuffer> {
    const raw = await blob.arrayBuffer();
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const decodeCtx = new AudioCtx();
    try {
      return await decodeCtx.decodeAudioData(raw.slice(0));
    } finally {
      await decodeCtx.close().catch(() => {});
    }
  }

  private async resampleTo16kMono(audioBuffer: AudioBuffer): Promise<Float32Array> {
    const mono = this.mixToMono(audioBuffer);
    const durationSeconds = mono.length / audioBuffer.sampleRate;
    const targetLength = Math.max(1, Math.ceil(durationSeconds * TARGET_STT_SAMPLE_RATE));

    const offlineCtx = new OfflineAudioContext(
      1,
      targetLength,
      TARGET_STT_SAMPLE_RATE,
    );
    const monoBuffer = offlineCtx.createBuffer(1, mono.length, audioBuffer.sampleRate);
    monoBuffer.getChannelData(0).set(mono);

    const source = offlineCtx.createBufferSource();
    source.buffer = monoBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    const rendered = await offlineCtx.startRendering();
    return rendered.getChannelData(0).slice();
  }

  private mixToMono(audioBuffer: AudioBuffer): Float32Array {
    if (audioBuffer.numberOfChannels === 1) {
      return audioBuffer.getChannelData(0).slice();
    }

    const output = new Float32Array(audioBuffer.length);
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      for (let i = 0; i < channelData.length; i++) {
        output[i] += channelData[i];
      }
    }

    const channelCount = audioBuffer.numberOfChannels;
    for (let i = 0; i < output.length; i++) {
      output[i] /= channelCount;
    }
    return output;
  }

  private encodeWavPcm16(samples: Float32Array, sampleRate: number): Blob {
    const bytesPerSample = 2;
    const blockAlign = bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    this.writeAscii(view, 0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    this.writeAscii(view, 8, "WAVE");
    this.writeAscii(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    this.writeAscii(view, 36, "data");
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += 2;
    }

    return new Blob([buffer], { type: "audio/wav" });
  }

  private writeAscii(view: DataView, offset: number, value: string): void {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  }

  private cleanup(): void {
    // Stop MediaRecorder
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch {
        // Already stopped
      }
    }
    this.mediaRecorder = null;
    this.chunks = [];

    // Disconnect audio nodes
    if (this.source) {
      try {
        this.source.disconnect();
      } catch {
        // Already disconnected
      }
      this.source = null;
    }

    this.analyser = null;

    // Close AudioContext
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(() => {});
    }
    this.audioContext = null;

    // Stop all media tracks
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    this.setState("idle");
  }

  // ── Lifecycle ──

  dispose(): void {
    this.cleanup();
  }
}

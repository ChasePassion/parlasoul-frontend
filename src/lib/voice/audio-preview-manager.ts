"use client";

export type AudioPreviewPhase = "idle" | "loading" | "playing";

export interface AudioPreviewSnapshot {
  activeId: string | null;
  phase: AudioPreviewPhase;
}

type Listener = () => void;
type AudioPreviewSource =
  | { kind: "url"; url: string }
  | { kind: "blob"; load: () => Promise<Blob> };

class AudioPreviewManager {
  private audio: HTMLAudioElement | null = null;
  private managedObjectUrl: string | null = null;
  private listeners = new Set<Listener>();
  private requestId = 0;
  private snapshot: AudioPreviewSnapshot = {
    activeId: null,
    phase: "idle",
  };

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): AudioPreviewSnapshot => this.snapshot;

  async play(id: string, source: AudioPreviewSource): Promise<void> {
    const audio = this.getOrCreateAudio();
    const currentRequestId = ++this.requestId;

    this.resetAudioElement(audio);
    this.setSnapshot({
      activeId: id,
      phase: "loading",
    });

    try {
      let resolvedUrl = "";
      if (source.kind === "url") {
        if (!source.url) {
          this.stop();
          return;
        }
        resolvedUrl = source.url;
      } else {
        const blob = await source.load();
        if (currentRequestId !== this.requestId || this.snapshot.activeId !== id) {
          return;
        }
        this.managedObjectUrl = URL.createObjectURL(blob);
        resolvedUrl = this.managedObjectUrl;
      }

      audio.src = resolvedUrl;
      await audio.play();

      if (
        currentRequestId !== this.requestId ||
        this.snapshot.activeId !== id
      ) {
        return;
      }

      this.setSnapshot({
        activeId: id,
        phase: "playing",
      });
    } catch (error) {
      if (currentRequestId !== this.requestId) {
        return;
      }
      this.stop();
      throw error;
    }
  }

  stop(id?: string): void {
    if (id && this.snapshot.activeId !== id) {
      return;
    }

    this.requestId += 1;

    if (this.audio) {
      this.resetAudioElement(this.audio);
    }

    this.setSnapshot({
      activeId: null,
      phase: "idle",
    });
  }

  release(id: string): void {
    if (this.snapshot.activeId === id) {
      this.stop(id);
    }
  }

  private getOrCreateAudio(): HTMLAudioElement {
    if (!this.audio) {
      const audio = new Audio();
      audio.preload = "none";
      audio.onended = () => {
        this.setSnapshot({
          activeId: null,
          phase: "idle",
        });
      };
      audio.onerror = () => {
        this.setSnapshot({
          activeId: null,
          phase: "idle",
        });
      };
      this.audio = audio;
    }

    return this.audio;
  }

  private resetAudioElement(audio: HTMLAudioElement): void {
    audio.pause();
    audio.currentTime = 0;
    audio.removeAttribute("src");
    audio.load();
    this.revokeManagedObjectUrl();
  }

  private setSnapshot(nextSnapshot: AudioPreviewSnapshot): void {
    if (
      this.snapshot.activeId === nextSnapshot.activeId &&
      this.snapshot.phase === nextSnapshot.phase
    ) {
      return;
    }

    this.snapshot = nextSnapshot;
    this.listeners.forEach((listener) => listener());
  }

  private revokeManagedObjectUrl(): void {
    if (!this.managedObjectUrl) {
      return;
    }
    URL.revokeObjectURL(this.managedObjectUrl);
    this.managedObjectUrl = null;
  }
}

export const audioPreviewManager = new AudioPreviewManager();

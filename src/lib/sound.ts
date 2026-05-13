let cachedAudio: HTMLAudioElement | null = null;

export function playGrowthNotification(): void {
  if (typeof window === "undefined") return;

  if (!cachedAudio) {
    cachedAudio = new Audio("/sounds/growth-notification.wav");
    cachedAudio.volume = 0.6;
  }

  cachedAudio.currentTime = 0;
  cachedAudio.play().catch(() => {});
}

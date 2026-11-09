/** Shared formatting for voice-clone recordings shown in the composer and thread. */

export function formatClipDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function formatAudioKind(name: string): string {
  const extension = name.split(".").pop()?.trim().toUpperCase() ?? "";
  if (!extension || extension === name.toUpperCase() || extension.length > 4) {
    return "AUDIO";
  }
  return extension;
}

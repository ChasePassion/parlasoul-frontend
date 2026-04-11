export const Module = {
  CHARACTER: "character",
} as const;

export const CharacterEvent = {
  STARTED: "character.started",
  VOICE_RESOLVED: "character.voice_resolved",
  API_CALLED: "character.api_called",
  COMPLETED: "character.completed",
  FAILED: "character.failed",
} as const;

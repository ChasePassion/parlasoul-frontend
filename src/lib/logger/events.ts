export const Module = {
  CHARACTER: "character",
  REALTIME: "realtime",
} as const;

export const CharacterEvent = {
  STARTED: "character.started",
  VOICE_RESOLVED: "character.voice_resolved",
  API_CALLED: "character.api_called",
  COMPLETED: "character.completed",
  FAILED: "character.failed",
} as const;

export const RealtimeEvent = {
  START_REQUESTED: "realtime.start_requested",
  CONNECT_STARTED: "realtime.connect_started",
  CONNECT_SIGNALLED: "realtime.connect_signalled",
  DISCONNECTED: "realtime.disconnected",
  START_ABORTED: "realtime.start_aborted",
  START_FAILED: "realtime.start_failed",
  MIC_CAPTURE_REQUESTED: "realtime.mic_capture_requested",
  MIC_CAPTURE_APPLIED: "realtime.mic_capture_applied",
  MIC_CAPTURE_FAILED: "realtime.mic_capture_failed",
} as const;

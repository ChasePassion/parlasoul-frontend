export const Module = {
  CHARACTER: "character",
  REALTIME: "realtime",
  AUTH: "auth",
  VOICE: "voice",
  SCROLL: "scroll",
} as const;

export type ModuleType = (typeof Module)[keyof typeof Module];

export const CharacterEvent = {
  STARTED: "character.started",
  VOICE_RESOLVED: "character.voice_resolved",
  API_CALLED: "character.api_called",
  COMPLETED: "character.completed",
  FAILED: "character.failed",
} as const;

export const AuthEvent = {
  EMAIL_OTP_DELIVERY_QUEUED: "email_otp.delivery_queued",
  EMAIL_OTP_DELIVERY_SENT: "email_otp.delivery_sent",
  EMAIL_OTP_DELIVERY_FAILED: "email_otp.delivery_failed",
} as const;

export const RealtimeEvent = {
  START_REQUESTED: "realtime.start_requested",
  CONNECT_STARTED: "realtime.connect_started",
  CONNECT_STAGE: "realtime.connect_stage",
  CONNECT_SIGNALLED: "realtime.connect_signalled",
  CONNECT_TIMEOUT: "realtime.connect.timeout",
  DISCONNECTED: "realtime.disconnected",
  START_ABORTED: "realtime.start_aborted",
  START_FAILED: "realtime.start_failed",
  MIC_CAPTURE_REQUESTED: "realtime.mic_capture_requested",
  MIC_CAPTURE_APPLIED: "realtime.mic_capture_applied",
  MIC_CAPTURE_FAILED: "realtime.mic_capture_failed",
} as const;

export const TtsEvent = {
  SCHEDULE_STARTED: "tts.schedule_started",
  SCHEDULE_DONE: "tts.schedule_done",
  FINISH: "tts.finish",
  UNDERRUN: "tts.underrun",
  MIME_SKIP: "tts.mime_skip",
  DECODE_FAILED: "tts.decode_failed",
  RESUME_FAILED: "tts.resume_failed",
  STREAM_ERROR: "tts.stream_error",
} as const;

export const ScrollEvent = {
  /** useLayoutEffect pinned scrollTop to scrollHeight */
  PIN_LAYOUT_FX: "scroll.pin_layout_fx",
  /** ResizeObserver pinned scrollTop to scrollHeight */
  PIN_RESIZE_OBS: "scroll.pin_resize_obs",
  /** User scrolled up → shouldAutoScroll set to false */
  USER_SCROLL_UP: "scroll.user_scroll_up",
  /** User reached bottom → shouldAutoScroll set to true */
  USER_AT_BOTTOM: "scroll.user_at_bottom",
  /** Wheel deltaY < 0 detected → shouldAutoScroll set to false */
  WHEEL_UP: "scroll.wheel_up",
  /** chatId changed → shouldAutoScroll reset to true */
  CHAT_RESET: "scroll.chat_reset",
} as const;

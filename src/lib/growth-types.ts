// =============================================================================
// Phase 5: Growth System Types
// =============================================================================

// ── Calendar ──

export type GrowthCalendarVisualStatus =
  | "natural_signed"
  | "makeup_signed"
  | "missed"
  | "today_pending"
  | "today_natural_signed"
  | "today_makeup_signed"
  | "future";

export interface GrowthCalendarDay {
  date: string;
  day_of_month: number;
  visual_status: GrowthCalendarVisualStatus;
  is_today: boolean;
  is_future: boolean;
  is_natural_signed: boolean;
  is_makeup_signed: boolean;
  can_make_up: boolean;
}

export interface GrowthCalendarMonth {
  month: string;
  days: GrowthCalendarDay[];
}

// ── Reading Equivalent ──

export interface GrowthReadingEquivalent {
  word_count: number;
  cet4_equivalent: number;
  cet6_equivalent: number;
}

// ── Today Summary ──

export interface GrowthTodaySummary {
  stat_date: string;
  timezone: string;
  signin_threshold: number;
  user_signin_message_count: number;
  remaining_user_messages: number;
  is_checked_in: boolean;
  checked_in_at: string | null;
  current_natural_streak: number;
  longest_natural_streak: number;
  makeup_card_balance: number;
  today_total_message_count: number;
  today_total_word_count: number;
  today_reading_equivalent: GrowthReadingEquivalent;
}

// ── Entry ──

export interface GrowthPopup {
  should_show: boolean;
  slogan: string;
  calendar: GrowthCalendarMonth;
}

export interface GrowthEntryResponse {
  server_now: string;
  today: GrowthTodaySummary;
  popup: GrowthPopup;
}

// ── Calendar API ──

export interface GrowthCalendarResponse {
  today: GrowthTodaySummary;
  calendar: GrowthCalendarMonth;
}

// ── Make-Up ──

export interface GrowthMakeUpRequest {
  target_date: string;
}

export interface GrowthMakeUpResponse {
  target_date: string;
  updated_day: GrowthCalendarDay;
  makeup_card_balance: number;
  current_natural_streak: number;
  longest_natural_streak: number;
}

// ── Chat Header Ring ──

export interface GrowthCharacterSummary {
  character_id: string;
  character_name: string;
  avatar_file_name: string | null;
  total_message_count: number;
  total_word_count: number;
  total_reading_equivalent: GrowthReadingEquivalent;
  chatted_days_count: number;
  total_exchange_count: number;
  last_chat_at: string | null;
}

export interface GrowthChatHeaderResponse {
  chat_id: string;
  character_id: string;
  ring_unit_words: number;
  current_chat_total_english_words: number;
  completed_loops: number;
  current_loop_progress_words: number;
  current_loop_progress_ratio: number;
  next_loop_remaining_words: number;
  character_summary: GrowthCharacterSummary;
}

// ── Overview ──

export interface GrowthCharacterHeadline {
  character_id: string;
  character_name: string;
  avatar_file_name: string | null;
  total_message_count: number;
  chatted_days_count: number;
  total_exchange_count: number;
}

export interface GrowthKpis {
  current_natural_streak: number;
  longest_natural_streak: number;
  makeup_card_balance: number;
  distinct_characters_chatted: number;
  total_message_count: number;
  total_word_count: number;
  today_message_count: number;
  today_word_count: number;
  top_character: GrowthCharacterHeadline | null;
}

export interface GrowthTrendPoint {
  stat_date: string;
  total_message_count: number;
  total_word_count: number;
  is_natural_signed: boolean;
  is_makeup_signed: boolean;
}

export interface GrowthRankingItem {
  character_id: string;
  character_name: string;
  avatar_file_name: string | null;
  total_message_count: number;
  total_word_count: number;
  chatted_days_count: number;
  total_exchange_count: number;
  last_chat_at: string | null;
}

export interface GrowthReadingEquivalenceBlock {
  global_today: GrowthReadingEquivalent;
  global_history: GrowthReadingEquivalent;
  focus_character_today: GrowthReadingEquivalent | null;
  focus_character_history: GrowthReadingEquivalent | null;
  focus_character: GrowthCharacterHeadline | null;
}

export interface GrowthOverviewResponse {
  kpis: GrowthKpis;
  trends: {
    last_7_days: GrowthTrendPoint[];
    last_30_days: GrowthTrendPoint[];
  };
  rankings: {
    by_messages: GrowthRankingItem[];
    by_words: GrowthRankingItem[];
    by_chatted_days: GrowthRankingItem[];
  };
  reading_equivalence: GrowthReadingEquivalenceBlock;
}

// ── Character Ledger ──

export type GrowthCharacterSortBy =
  | "total_message_count"
  | "total_word_count"
  | "chatted_days_count"
  | "last_chat_at";

export interface GrowthCharacterRow {
  character_id: string;
  character_name: string;
  avatar_file_name: string | null;
  total_message_count: number;
  total_word_count: number;
  chatted_days_count: number;
  total_exchange_count: number;
  last_chat_at: string | null;
}

export interface GrowthCharactersPageResponse {
  items: GrowthCharacterRow[];
  next_cursor: string | null;
  has_more: boolean;
}

// ── Share Cards ──

export type GrowthShareCardKind =
  | "daily_signin_completed"
  | "character_message_milestone";

export interface DailySigninShareCardPayload {
  stat_date: string;
  today_user_message_count: number;
  today_total_word_count: number;
  reading_equivalent: GrowthReadingEquivalent;
  current_natural_streak: number;
}

export interface CharacterMilestoneShareCardPayload {
  character_id: string;
  character_name: string;
  avatar_file_name: string | null;
  milestone_message_count: number;
  total_word_count: number;
  chatted_days_count: number;
  total_exchange_count: number;
  reading_equivalent: GrowthReadingEquivalent;
}

export interface GrowthShareCard {
  id: string;
  kind: GrowthShareCardKind;
  triggered_at: string;
  chat_id: string | null;
  character_id: string | null;
  title: string;
  subtitle: string | null;
  primary_button_label: string;
  daily_signin_payload: DailySigninShareCardPayload | null;
  character_milestone_payload: CharacterMilestoneShareCardPayload | null;
}

export interface GrowthShareCardsPageResponse {
  items: GrowthShareCard[];
}

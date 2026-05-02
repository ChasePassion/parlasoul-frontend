import { httpClient } from "./http-client";
import { ApiError, UnauthorizedError } from "./token-store";
import { getErrorMessage } from "./error-map";
import type { GrowthTodaySummary, GrowthShareCard } from "./growth-types";
import { fetchWithBetterAuth } from "./better-auth-token";
import {
  parseJsonResponse,
  throwApiErrorResponse,
  unwrapEnvelopePayload,
} from "./http-client";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LearningAssistantContextMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LearningAssistantStreamRequest {
  question: string;
  character_chat_context?: LearningAssistantContextMessage[];
  assistant_chat_context?: LearningAssistantContextMessage[];
  chat_id?: string;
}

export interface MemoryManageRequest {
  character_id: string;
  chat_id: string;
  user_text: string;
  assistant_text: string;
}

export interface MemorySearchRequest {
  character_id: string;
  query: string;
}

export interface User {
  id: string;
  email: string;
  username?: string;
  email_verified?: boolean;
  avatar_image_key?: string | null;
  avatar_urls?: AvatarUrls | null;
  created_at: string;
  last_login_at?: string;
}

export interface UpdateProfileRequest {
  username?: string;
  avatar_image_key?: string | null;
}

export interface AvatarUrls {
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

export type DisplayMode = "concise" | "detailed";

export interface UserSettingsResponse {
  display_mode: DisplayMode;
  memory_enabled: boolean;
  reply_card_enabled: boolean;
  mixed_input_auto_translate_enabled: boolean;
  auto_read_aloud_enabled: boolean;
  preferred_expression_bias_enabled: boolean;
  message_font_size: number;
  updated_at: string;
}

export interface UpdateUserSettingsRequest {
  display_mode?: DisplayMode;
  memory_enabled?: boolean;
  reply_card_enabled?: boolean;
  mixed_input_auto_translate_enabled?: boolean;
  auto_read_aloud_enabled?: boolean;
  preferred_expression_bias_enabled?: boolean;
  message_font_size?: number;
}

export type UserEntitlementTier = "free" | "plus" | "pro";

export interface UserEntitlementFeatures {
  voice_clone: boolean;
  memory_feature: boolean;
}

export interface UserEntitlementSettings {
  memory_enabled: boolean;
}

export type EffectiveEntitlementSource =
  | "none"
  | "recurring_subscription"
  | "one_time_pass";

export interface UserAccessPass {
  id: string;
  channel: "wechat_pay";
  product_id: string;
  tier: Extract<UserEntitlementTier, "plus" | "pro">;
  starts_at: string;
  ends_at: string;
  status: "active" | "expired" | "refunded" | "revoked";
  source_order_id: string;
}

export interface UserEntitlementsResponse {
  tier: UserEntitlementTier;
  subscription_status: string | null;
  subscription_product_id: string | null;
  current_period_end: string | null;
  effective_source: EffectiveEntitlementSource;
  effective_expires_at: string | null;
  active_pass: UserAccessPass | null;
  features: UserEntitlementFeatures;
  settings: UserEntitlementSettings;
}

export interface WechatPaymentProduct {
  product_id: string;
  name: string;
  tier: Extract<UserEntitlementTier, "plus" | "pro">;
  duration_days: number;
  base_price_minor: number;
  base_price_currency: string;
  base_price_display: string;
  billing_currency: string;
  channel: "wechat_pay";
  price_note: string;
}

export interface WechatPaymentProductListResponse {
  items: WechatPaymentProduct[];
}

export interface CreateWechatCheckoutSessionResponse {
  order_id: string;
  checkout_url: string;
  checkout_session_id: string;
  product_id: string;
  tier: Extract<UserEntitlementTier, "plus" | "pro">;
  duration_days: number;
  billing_currency: string;
  channel: "wechat_pay";
}

export interface PaymentOrderResponse {
  id: string;
  status:
    | "created"
    | "checkout_created"
    | "pending"
    | "succeeded"
    | "failed"
    | "cancelled"
    | "refunded"
    | "expired";
  product_id: string;
  tier: Extract<UserEntitlementTier, "plus" | "pro">;
  duration_days: number;
  channel: "wechat_pay";
  billing_currency: string;
  paid_at: string | null;
  refunded_at: string | null;
  created_at: string;
  charged_total_minor: number | null;
  charged_currency: string | null;
  settlement_total_minor: number | null;
  settlement_currency: string | null;
}

export type CharacterVisibility = "PUBLIC" | "PRIVATE";
export type CharacterStatus = "ACTIVE" | "UNPUBLISHED";
export type ChatVisibility = CharacterVisibility;
export type ChatState = "ACTIVE" | "ARCHIVED";
export type ChatType = "ONE_ON_ONE" | "ROOM";
export type TurnAuthorType = "USER" | "CHARACTER" | "SYSTEM";
export type TurnState = "OK" | "FILTERED" | "DELETED" | "ERROR";

// Phase 2.1: Voice types
export type VoiceSourceType = "system" | "clone" | "designed" | "imported";
export type VoiceStatus = "creating" | "processing" | "ready" | "failed" | "deleting" | "deleted";

export type LLMPresetId = "free" | "flagship";
export type DialogueStyleId =
  | "true_nature"
  | "spring_breeze"
  | "free_spirit"
  | "clear_inquiry"
  | "poetic_reserve"
  | "proud_resolve";

export interface VoiceSelectableItem {
  id: string;
  display_name: string;
  source_type: VoiceSourceType;
  provider: string;
  provider_model: string | null;
  provider_voice_id: string;
  avatar_image_key?: string | null;
  avatar_urls?: AvatarUrls | null;
  preview_text?: string | null;
  preview_audio_url: string | null;
  usage_hint: string | null;
}

export interface VoiceProfile {
  id: string;
  owner_user_id: string | null;
  provider: string;
  provider_voice_id: string;
  provider_model: string | null;
  source_type: VoiceSourceType;
  display_name: string;
  description: string | null;
  avatar_image_key?: string | null;
  avatar_urls?: AvatarUrls | null;
  status: VoiceStatus;
  provider_status: string | null;
  preview_text?: string | null;
  preview_audio_url: string | null;
  language_tags: string[] | null;
  metadata: Record<string, unknown> | null;
  bound_character_count?: number;
  bound_character_ids?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface VoiceProfilesPage {
  items: VoiceProfile[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface VoiceCatalogResponse {
  items: VoiceSelectableItem[];
}

export interface VoiceProfileUpdate {
  display_name?: string;
  description?: string | null;
  preview_text?: string | null;
  avatar_image_key?: string | null;
  character_ids?: string[];
}

export interface CreateCharacterRequest {
  name: string;
  description: string;
  system_prompt: string;
  greeting_message?: string;
  avatar_image_key?: string | null;
  visibility?: CharacterVisibility;
  voice_provider: string;
  voice_model: string;
  voice_provider_voice_id: string;
  voice_source_type: VoiceSourceType;
  llm_preset_id?: LLMPresetId | null;
  dialogue_style_id?: DialogueStyleId | null;
}
export interface CharacterResponse {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  greeting_message?: string;
  avatar_image_key?: string | null;
  avatar_urls?: AvatarUrls | null;
  voice_provider: string;
  voice_model: string;
  voice_provider_voice_id: string;
  voice_source_type: VoiceSourceType;
  voice?: VoiceSelectableItem | null;
  llm_preset_id?: LLMPresetId | null;
  dialogue_style_id?: DialogueStyleId | null;
  creator_id: string | null;
  creator_username?: string | null;
  status: CharacterStatus;
  unpublished_at?: string | null;
  visibility: CharacterVisibility;
  identifier?: string;
  interaction_count: number;
  distinct_user_count: number;
}

export interface CharacterBrief {
  id: string;
  name: string;
  description: string;
  greeting_message?: string;
  avatar_image_key?: string | null;
  avatar_urls?: AvatarUrls | null;
  voice_provider?: string;
  voice_model?: string;
  voice_provider_voice_id?: string;
  voice_source_type?: VoiceSourceType;
  voice?: VoiceSelectableItem | null;
  status: CharacterStatus;
  unpublished_at?: string | null;
  visibility: CharacterVisibility;
  creator_id?: string | null;
  creator_username?: string | null;
  interaction_count: number;
}

export interface ChatResponse {
  id: string;
  user_id: string;
  character_id: string;
  title: string;
  type: ChatType;
  state: ChatState;
  visibility: ChatVisibility;
  last_turn_at?: string | null;
  last_turn_id?: string | null;
  last_turn_no?: number | null;
  active_leaf_turn_id?: string | null;
  last_read_turn_no?: number | null;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  meta?: Record<string, unknown> | null;
}

export interface ReplyCardPhrase {
  surface: string;
  zh: string;
  ipa_us: string;
}

export interface ReplyCardFavoriteState {
  enabled: boolean;
  is_favorited: boolean;
  saved_item_id?: string | null;
}

export interface ReplyCard {
  surface: string;
  zh: string;
  key_phrases: ReplyCardPhrase[];
  favorite: ReplyCardFavoriteState;
}

export interface ReplySuggestion {
  type: "relationship" | "topic" | "interaction";
  en: string;
  zh: string;
}

export interface InputTransform {
  applied: boolean;
  transformed_content: string;
}

export interface SavedItemDisplay {
  surface: string;
  zh: string;
}

export type SavedItemKind = "reply_card" | "word_card" | "feedback_card";

export interface SavedItemSource {
  role_id: string;
  chat_id: string;
  message_id: string;
  turn_id?: string | null;
  candidate_id?: string | null;
  meta?: Record<string, unknown> | null;
}

export interface SavedItemPayload {
  kind: SavedItemKind;
  display: SavedItemDisplay;
  card: ReplyCard | WordCard | FeedbackCard;
  source: SavedItemSource;
}

export interface SavedItemResponse extends SavedItemPayload {
  id: string;
  created_at: string;
}

export interface SavedItemsPage {
  items: SavedItemResponse[];
  next_cursor?: string | null;
  has_more: boolean;
}

export interface CandidateExtra {
  input_transform?: InputTransform | null;
  reply_card?: ReplyCard | null;
  interrupted?: boolean;
}

export interface CandidateResponse {
  id: string;
  candidate_no: number;
  content: string;
  model_type?: string | null;
  is_final: boolean;
  rank?: number | null;
  created_at: string;
  extra?: CandidateExtra | null;
}

export interface TurnResponse {
  id: string;
  turn_no: number;
  author_type: TurnAuthorType;
  state: TurnState;
  is_proactive: boolean;
  parent_turn_id?: string | null;
  parent_candidate_id?: string | null;
  primary_candidate: CandidateResponse;
  candidate_count: number;
}

export interface ChatDetailResponse {
  chat: ChatResponse;
  character: CharacterBrief;
}

export interface ChatCreateRequest {
  character_id: string;
  meta?: Record<string, unknown>;
}

export interface ChatCreateResponse {
  chat: ChatResponse;
  character: CharacterBrief;
  initial_turns: TurnResponse[];
}

export interface ChatHistoryItem {
  chat: ChatResponse;
  character: CharacterBrief;
}

export interface ChatsPageResponse {
  items: ChatHistoryItem[];
  next_cursor?: string | null;
  has_more: boolean;
}

export interface ChatUpdateRequest {
  title: string;
}

export interface TurnsPageResponse {
  chat: ChatResponse;
  character: CharacterBrief;
  turns: TurnResponse[];
  next_before_turn_id?: string | null;
  has_more: boolean;
}

export interface ChatStreamRequest {
  content: string;
}

export interface TurnSelectRequest {
  candidate_no: number;
}

export interface TurnSelectResponse {
  chat_id: string;
  turn_id: string;
  primary_candidate_id: string;
  primary_candidate_no: number;
  candidate_count: number;
  active_leaf_turn_id: string;
}

export interface TurnSelectSnapshotResponse {
  select_result: TurnSelectResponse;
  snapshot: TurnsPageResponse;
}

export interface UserTurnEditStreamRequest {
  content: string;
}

export interface UpdateCharacterRequest {
  name?: string;
  description?: string;
  system_prompt?: string;
  greeting_message?: string;
  avatar_image_key?: string | null;
  voice_provider?: string;
  voice_model?: string;
  voice_provider_voice_id?: string;
  voice_source_type?: VoiceSourceType;
  visibility?: CharacterVisibility;
  llm_preset_id?: LLMPresetId | null;
  dialogue_style_id?: DialogueStyleId | null;
}
interface StreamChunkEvent {
  type: "chunk";
  content: string;
}

interface StreamDoneEvent {
  type: "done";
  full_content: string;
  assistant_turn_id?: string;
  assistant_candidate_id?: string;
}

interface StreamErrorEvent {
  type: "error";
  code?: string;
  message?: string;
}

type StreamEvent = StreamChunkEvent | StreamDoneEvent | StreamErrorEvent;

interface TurnStreamMetaEvent {
  type: "meta";
  user_turn?: {
    id: string;
    candidate_id: string;
    candidate_no?: number;
  };
  assistant_turn: {
    id: string;
    candidate_id: string;
    turn_no?: number;
    candidate_no?: number;
  };
}

interface TurnStreamReplySuggestionsEvent {
  type: "reply_suggestions";
  assistant_candidate_id: string;
  suggestions: ReplySuggestion[];
}

interface TurnStreamTransformDoneEvent {
  type: "transform_done";
  original_content: string;
  transformed_content: string;
  applied: boolean;
}

interface TurnStreamReplyCardStartedEvent {
  type: "reply_card_started";
  assistant_candidate_id: string;
}

interface TurnStreamReplyCardEvent {
  type: "reply_card";
  assistant_candidate_id: string;
  reply_card: ReplyCard;
}

interface TurnStreamReplyCardErrorEvent {
  type: "reply_card_error";
  assistant_candidate_id: string;
  code: string;
  message: string;
}

interface TurnStreamTtsAudioDeltaEvent {
  type: "tts_audio_delta";
  assistant_candidate_id: string;
  seq: number;
  audio_b64: string;
  mime_type: string;
}

interface TurnStreamTtsAudioDoneEvent {
  type: "tts_audio_done";
  assistant_candidate_id: string;
}

interface TurnStreamTtsErrorEvent {
  type: "tts_error";
  code: string;
  message: string;
}

type TurnStreamEvent =
  | StreamEvent
  | TurnStreamMetaEvent
  | TurnStreamTransformDoneEvent
  | TurnStreamReplySuggestionsEvent
  | TurnStreamReplyCardStartedEvent
  | TurnStreamReplyCardEvent
  | TurnStreamReplyCardErrorEvent
  | TurnStreamTtsAudioDeltaEvent
  | TurnStreamTtsAudioDoneEvent
  | TurnStreamTtsErrorEvent;

interface ChatStreamMetaEvent {
  type: "meta";
  user_turn: { id: string; turn_no: number; candidate_id: string };
  assistant_turn: { id: string; turn_no: number; candidate_id: string };
}

interface ChatStreamTransformChunkEvent {
  type: "transform_chunk";
  content: string;
}

interface ChatStreamTransformDoneEvent {
  type: "transform_done";
  original_content: string;
  transformed_content: string;
  applied: boolean;
}

interface ChatStreamChunkEvent {
  type: "chunk";
  content: string;
}

interface ChatStreamDoneEvent {
  type: "done";
  full_content: string;
  assistant_turn_id?: string;
  assistant_candidate_id?: string;
}

interface ChatStreamReplySuggestionsEvent {
  type: "reply_suggestions";
  assistant_candidate_id: string;
  suggestions: ReplySuggestion[];
}

interface ChatStreamReplyCardStartedEvent {
  type: "reply_card_started";
  assistant_candidate_id: string;
}

interface ChatStreamReplyCardEvent {
  type: "reply_card";
  assistant_candidate_id: string;
  reply_card: ReplyCard;
}

interface ChatStreamReplyCardErrorEvent {
  type: "reply_card_error";
  assistant_candidate_id: string;
  code: string;
  message: string;
}

interface ChatStreamMemoryQueuedEvent {
  type: "memory_queued";
  status: string;
}

interface ChatStreamGrowthDailyUpdatedEvent {
  type: "growth_daily_updated";
  today: GrowthTodaySummary;
}

interface ChatStreamGrowthShareCardReadyEvent {
  type: "growth_share_card_ready";
  share_card: GrowthShareCard;
}

interface ChatStreamErrorEvent {
  type: "error";
  code?: string;
  message?: string;
}

// Phase 2: TTS realtime SSE events
interface ChatStreamTtsAudioDeltaEvent {
  type: "tts_audio_delta";
  assistant_candidate_id: string;
  seq: number;
  audio_b64: string;
  mime_type: string;
}

interface ChatStreamTtsAudioDoneEvent {
  type: "tts_audio_done";
  assistant_candidate_id: string;
}

interface ChatStreamTtsErrorEvent {
  type: "tts_error";
  code: string;
  message: string;
}

interface ChatStreamTitleUpdatedEvent {
  type: "chat_title_updated";
  chat_id: string;
  title: string;
}

// Phase 2: STT transcription result
export interface STTTranscriptionResult {
  text: string;
  model: string;
  request_id?: string | null;
}

export interface RealtimeSessionDescription {
  type: string;
  sdp: string;
}

export interface RealtimeSessionCreateRequest {
  chat_id: string;
  character_id: string;
  sdp: RealtimeSessionDescription;
}

export interface RealtimeIceConfigResponse {
  ice_servers: RTCIceServer[];
}

export interface RealtimeSessionCreateResponse {
  session_id: string;
  chat_id: string;
  character_id: string;
  sdp: RealtimeSessionDescription;
  ice_servers: RTCIceServer[];
}

// =============================================================================
// Phase 3: Learning types
// =============================================================================

// Word Card (from text selection)
export interface WordCardSense {
  zh: string;
  note: string | null;
}

export interface WordCardPosGroup {
  pos: string;
  senses: WordCardSense[];
}

export interface WordCardExample {
  surface: string;
  zh: string;
}

export interface WordCardFavoriteState {
  enabled: boolean;
  is_favorited: boolean;
  saved_item_id?: string | null;
}

export interface WordCard {
  surface: string;
  ipa_us: string;
  pos_groups: WordCardPosGroup[];
  example: WordCardExample;
  favorite: WordCardFavoriteState;
}

export interface WordCardGenerateRequest {
  selected_text: string;
  context_text?: string | null;
}

// Feedback Card (for user message improvement)
export interface KeyPhrase {
  surface: string;
  ipa_us: string;
  zh: string;
}

export interface FeedbackCard {
  surface: string;
  zh: string;
  key_phrases: KeyPhrase[];
  favorite: WordCardFavoriteState;
}

// Phase 3: SavedItem types with kind support
export type SavedItemKindPhase3 = SavedItemKind;

export interface SavedItemPayloadPhase3 {
  kind: SavedItemKindPhase3;
  display: {
    surface: string;
    zh: string;
  };
  card: WordCard | ReplyCard | FeedbackCard;
  source: {
    role_id: string;
    chat_id: string;
    message_id: string;
    turn_id?: string | null;
    candidate_id?: string | null;
    meta?: Record<string, unknown> | null;
  };
}

export interface SavedItemResponsePhase3 extends SavedItemPayloadPhase3 {
  id: string;
  created_at: string;
}

export interface SavedItemsPagePhase3 {
  items: SavedItemResponsePhase3[];
  next_cursor: string | null;
  has_more: boolean;
}

type ChatStreamEvent =
  | ChatStreamMetaEvent
  | ChatStreamTitleUpdatedEvent
  | ChatStreamTransformChunkEvent
  | ChatStreamTransformDoneEvent
  | ChatStreamChunkEvent
  | ChatStreamDoneEvent
  | ChatStreamReplySuggestionsEvent
  | ChatStreamReplyCardStartedEvent
  | ChatStreamReplyCardEvent
  | ChatStreamReplyCardErrorEvent
  | ChatStreamMemoryQueuedEvent
  | ChatStreamGrowthDailyUpdatedEvent
  | ChatStreamGrowthShareCardReadyEvent
  | ChatStreamErrorEvent
  | ChatStreamTtsAudioDeltaEvent
  | ChatStreamTtsAudioDoneEvent
  | ChatStreamTtsErrorEvent;

interface LearningAssistantChunkEvent {
  type: "chunk";
  content: string;
}

interface LearningAssistantDoneEvent {
  type: "done";
  full_content: string;
}

interface LearningAssistantErrorEvent {
  type: "error";
  code?: string;
  message?: string;
}

type LearningAssistantStreamEvent =
  | LearningAssistantChunkEvent
  | LearningAssistantDoneEvent
  | LearningAssistantErrorEvent;

type ApiRequestOptions = {
  signal?: AbortSignal;
};

type MediaUploadKind = "user_avatar" | "character_avatar" | "voice_avatar";

interface UploadFileOptions extends ApiRequestOptions {
  kind?: MediaUploadKind;
}

interface PresignedUploadResponse {
  upload_id: string;
  image_key: string;
  original_object_key: string;
  upload_url: string;
  expires_in_seconds: number;
  required_headers: Record<string, string>;
}

interface CompleteUploadResponse {
  upload_id: string;
  image_key: string;
  avatar_urls: AvatarUrls;
  content_type: "image/avif";
}

export interface UploadImageResult extends CompleteUploadResponse {
  url: string;
}

export class ApiService {
  async uploadFile(
    file: File,
    options: UploadFileOptions = {},
  ): Promise<UploadImageResult> {
    const presigned = await httpClient.post<
      PresignedUploadResponse,
      { kind: MediaUploadKind; mime_type: string; size_bytes: number }
    >(
      "/v1/uploads/presign",
      {
        kind: options.kind ?? "character_avatar",
        mime_type: file.type,
        size_bytes: file.size,
      },
      { signal: options.signal },
    );

    const putResponse = await fetch(presigned.upload_url, {
      method: "PUT",
      headers: presigned.required_headers,
      body: file,
      signal: options.signal,
    });

    if (!putResponse.ok) {
      throw new ApiError(putResponse.status, "external_error", "图片上传到对象存储失败");
    }

    const completed = await httpClient.post<
      CompleteUploadResponse,
      { upload_id: string; etag: string | null }
    >(
      "/v1/uploads/complete",
      {
        upload_id: presigned.upload_id,
        etag: putResponse.headers.get("ETag"),
      },
      { signal: options.signal },
    );

    return {
      ...completed,
      url: completed.avatar_urls.md,
    };
  }

  async updateUserProfile(
    data: UpdateProfileRequest,
    options: ApiRequestOptions = {},
  ): Promise<User> {
    return httpClient.put<User>("/v1/users/me", data, options);
  }

  async getMyProfile(options: ApiRequestOptions = {}): Promise<User> {
    return httpClient.get<User>("/v1/users/me", options);
  }

  async getMySettings(
    options: ApiRequestOptions = {},
  ): Promise<UserSettingsResponse> {
    return httpClient.get<UserSettingsResponse>("/v1/users/me/settings", options);
  }

  async updateMySettings(
    data: UpdateUserSettingsRequest,
    options: ApiRequestOptions = {},
  ): Promise<UserSettingsResponse> {
    return httpClient.patch<UserSettingsResponse, UpdateUserSettingsRequest>(
      "/v1/users/me/settings",
      data,
      options,
    );
  }

  async getMyEntitlements(
    options: ApiRequestOptions = {},
  ): Promise<UserEntitlementsResponse> {
    return httpClient.get<UserEntitlementsResponse>(
      "/v1/users/me/entitlements",
      options,
    );
  }

  async getWechatPaymentProducts(
    options: ApiRequestOptions = {},
  ): Promise<WechatPaymentProductListResponse> {
    return httpClient.get<WechatPaymentProductListResponse>(
      "/v1/payments/wechat/products",
      options,
    );
  }

  async createWechatCheckoutSession(params: {
    product_id: string;
  }): Promise<CreateWechatCheckoutSessionResponse> {
    return httpClient.post<
      CreateWechatCheckoutSessionResponse,
      { product_id: string }
    >("/v1/payments/wechat/checkout-session", params);
  }

  async getWechatPaymentOrder(
    orderId: string,
    options: ApiRequestOptions = {},
  ): Promise<PaymentOrderResponse> {
    return httpClient.get<PaymentOrderResponse>(
      `/v1/payments/orders/${orderId}`,
      options,
    );
  }

  async listWechatPaymentOrders(params?: {
    channel?: "wechat_pay";
    skip?: number;
    limit?: number;
  }, options: ApiRequestOptions = {}): Promise<PaymentOrderResponse[]> {
    const searchParams = new URLSearchParams();
    if (params?.channel) {
      searchParams.set("channel", params.channel);
    }
    if (params?.skip !== undefined) {
      searchParams.set("skip", String(params.skip));
    }
    if (params?.limit !== undefined) {
      searchParams.set("limit", String(params.limit));
    }
    const query = searchParams.toString();
    const suffix = query ? `?${query}` : "";
    return httpClient.get<PaymentOrderResponse[]>(
      `/v1/payments/orders${suffix}`,
      options,
    );
  }

  async createCharacter(
    data: CreateCharacterRequest,
  ): Promise<CharacterResponse> {
    return httpClient.post<CharacterResponse>("/v1/characters", data);
  }

  async getMarketCharacters(
    skip = 0,
    limit = 20,
    options: ApiRequestOptions = {},
  ): Promise<CharacterResponse[]> {
    return httpClient.get<CharacterResponse[]>(
      `/v1/characters/market?skip=${skip}&limit=${limit}`,
      options,
    );
  }

  async getCharacterById(
    id: string,
    options: ApiRequestOptions = {},
  ): Promise<CharacterResponse> {
    return httpClient.get<CharacterResponse>(`/v1/characters/${id}`, options);
  }

  async getUserCharacters(
    creatorId: string,
    skip = 0,
    limit = 20,
    options: ApiRequestOptions = {},
  ): Promise<CharacterResponse[]> {
    return httpClient.get<CharacterResponse[]>(
      `/v1/users/${creatorId}/characters?skip=${skip}&limit=${limit}`,
      options,
    );
  }

  async updateCharacter(
    id: string,
    data: UpdateCharacterRequest,
  ): Promise<CharacterResponse> {
    return httpClient.put<CharacterResponse>(`/v1/characters/${id}`, data);
  }

  async unpublishCharacter(id: string): Promise<CharacterResponse> {
    return httpClient.post<CharacterResponse>(`/v1/characters/${id}/unpublish`, {});
  }

  async getRecentChat(
    characterId: string,
    options: ApiRequestOptions = {},
  ): Promise<ChatDetailResponse | null> {
    return httpClient.get<ChatDetailResponse | null>(
      `/v1/chats/recent?character_id=${characterId}`,
      options,
    );
  }

  async createChat(request: ChatCreateRequest): Promise<ChatCreateResponse> {
    return httpClient.post<ChatCreateResponse, ChatCreateRequest>(
      `/v1/chats`,
      request,
    );
  }

  async listChats(params: {
    character_id: string;
    cursor?: string;
    limit?: number;
  }, options: ApiRequestOptions = {}): Promise<ChatsPageResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set("character_id", params.character_id);
    if (params.cursor) {
      searchParams.set("cursor", params.cursor);
    }
    if (params.limit !== undefined) {
      searchParams.set("limit", String(params.limit));
    }

    const query = searchParams.toString();
    const suffix = query ? `?${query}` : "";

    return httpClient.get<ChatsPageResponse>(`/v1/chats${suffix}`, options);
  }

  async updateChat(
    chatId: string,
    request: ChatUpdateRequest,
  ): Promise<ChatResponse> {
    return httpClient.patch<ChatResponse, ChatUpdateRequest>(
      `/v1/chats/${chatId}`,
      request,
    );
  }

  async deleteChat(chatId: string): Promise<void> {
    await httpClient.delete(`/v1/chats/${chatId}`);
  }

  async getChatTurns(
    chatId: string,
    options: {
      before_turn_id?: string;
      limit?: number;
      include_learning_data?: boolean;
      signal?: AbortSignal;
    } = {},
  ): Promise<TurnsPageResponse> {
    const params = new URLSearchParams();
    if (options.before_turn_id)
      params.set("before_turn_id", String(options.before_turn_id));
    if (options.include_learning_data !== undefined)
      params.set("include_learning_data", String(options.include_learning_data));
    params.set("limit", String(options.limit ?? 20));
    const qs = params.toString();
    const suffix = qs ? `?${qs}` : "";
    return httpClient.get<TurnsPageResponse>(
      `/v1/chats/${chatId}/turns${suffix}`,
      { signal: options.signal },
    );
  }

  async selectTurnCandidate(
    turnId: string,
    req: TurnSelectRequest,
  ): Promise<TurnSelectResponse> {
    return httpClient.post<TurnSelectResponse, TurnSelectRequest>(
      `/v1/turns/${turnId}/select`,
      req,
    );
  }

  async selectTurnCandidateWithSnapshot(
    turnId: string,
    req: TurnSelectRequest,
    options: { limit?: number; include_learning_data?: boolean } = {},
  ): Promise<TurnSelectSnapshotResponse> {
    const params = new URLSearchParams();
    if (options.limit !== undefined) {
      params.set("limit", String(options.limit));
    }
    if (options.include_learning_data !== undefined) {
      params.set(
        "include_learning_data",
        String(options.include_learning_data),
      );
    }
    const qs = params.toString();
    const suffix = qs ? `?${qs}` : "";

    return httpClient.post<TurnSelectSnapshotResponse, TurnSelectRequest>(
      `/v1/turns/${turnId}/select/snapshot${suffix}`,
      req,
    );
  }

  async regenAssistantTurn(
    turnId: string,
    handlers: {
      signal?: AbortSignal;
      onMeta?: (meta: TurnStreamMetaEvent) => void;
      onChunk: (content: string) => void;
      onDone: (
        fullContent: string,
        assistantTurnId?: string,
        assistantCandidateId?: string,
      ) => void;
      onReplySuggestions?: (data: {
        assistant_candidate_id: string;
        suggestions: ReplySuggestion[];
      }) => void;
      onReplyCardStarted?: (data: { assistant_candidate_id: string }) => void;
      onReplyCard?: (data: {
        assistant_candidate_id: string;
        reply_card: ReplyCard;
      }) => void;
      onReplyCardError?: (data: {
        assistant_candidate_id: string;
        code: string;
        message: string;
      }) => void;
      onTtsAudioDelta?: (data: {
        assistant_candidate_id: string;
        seq: number;
        audio_b64: string;
        mime_type: string;
      }) => void;
      onTtsAudioDone?: (data: { assistant_candidate_id: string }) => void;
      onTtsError?: (data: { code: string; message: string }) => void;
      onError: (error: Error) => void;
    },
  ): Promise<void> {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      };

      const response = await fetchWithBetterAuth(`/v1/turns/${turnId}/regen/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
        signal: handlers.signal,
      });

      if (!response.ok) {
        return throwApiErrorResponse(response);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let pending = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        pending += decoder.decode(value, { stream: true });
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const payload = trimmed.slice(5).trim();
          if (!payload) continue;

          try {
            const data = JSON.parse(payload) as TurnStreamEvent;
            if (data.type === "meta") {
              handlers.onMeta?.(data);
            } else if (data.type === "chunk") {
              handlers.onChunk(data.content);
            } else if (data.type === "done") {
              handlers.onDone(
                data.full_content,
                data.assistant_turn_id,
                data.assistant_candidate_id,
              );
            } else if (data.type === "reply_suggestions") {
              handlers.onReplySuggestions?.({
                assistant_candidate_id: data.assistant_candidate_id,
                suggestions: data.suggestions,
              });
            } else if (data.type === "reply_card_started") {
              handlers.onReplyCardStarted?.({
                assistant_candidate_id: data.assistant_candidate_id,
              });
            } else if (data.type === "reply_card") {
              handlers.onReplyCard?.({
                assistant_candidate_id: data.assistant_candidate_id,
                reply_card: data.reply_card,
              });
            } else if (data.type === "reply_card_error") {
              handlers.onReplyCardError?.({
                assistant_candidate_id: data.assistant_candidate_id,
                code: data.code,
                message: data.message,
              });
            } else if (data.type === "tts_audio_delta") {
              handlers.onTtsAudioDelta?.({
                assistant_candidate_id: data.assistant_candidate_id,
                seq: data.seq,
                audio_b64: data.audio_b64,
                mime_type: data.mime_type,
              });
            } else if (data.type === "tts_audio_done") {
              handlers.onTtsAudioDone?.({
                assistant_candidate_id: data.assistant_candidate_id,
              });
            } else if (data.type === "tts_error") {
              handlers.onTtsError?.({
                code: data.code,
                message: data.message,
              });
            } else if (data.type === "error") {
              if (data.code && data.message) {
                handlers.onError(new Error(`${data.code}: ${data.message}`));
              } else {
                handlers.onError(new Error(data.message || "Unknown error"));
              }
            }
          } catch {
            // Ignore malformed stream rows.
          }
        }
      }
    } catch (error) {
      if (
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        return;
      }

      if (error instanceof UnauthorizedError) {
        handlers.onError(new Error(getErrorMessage(error)));
        return;
      }

      if (error instanceof ApiError) {
        handlers.onError(new Error(error.detail || `API error: ${error.status}`));
        return;
      }

      handlers.onError(
        error instanceof Error ? error : new Error("Unknown error"),
      );
    }
  }

  async editUserTurnAndStreamReply(
    turnId: string,
    request: UserTurnEditStreamRequest,
    handlers: {
      signal?: AbortSignal;
      onMeta?: (meta: TurnStreamMetaEvent) => void;
      onChunk: (content: string) => void;
      onTransformDone?: (data: {
        original_content: string;
        transformed_content: string;
        applied: boolean;
      }) => void;
      onDone: (
        fullContent: string,
        assistantTurnId?: string,
        assistantCandidateId?: string,
      ) => void;
      onReplySuggestions?: (data: {
        assistant_candidate_id: string;
        suggestions: ReplySuggestion[];
      }) => void;
      onReplyCardStarted?: (data: { assistant_candidate_id: string }) => void;
      onReplyCard?: (data: {
        assistant_candidate_id: string;
        reply_card: ReplyCard;
      }) => void;
      onReplyCardError?: (data: {
        assistant_candidate_id: string;
        code: string;
        message: string;
      }) => void;
      onTtsAudioDelta?: (data: {
        assistant_candidate_id: string;
        seq: number;
        audio_b64: string;
        mime_type: string;
      }) => void;
      onTtsAudioDone?: (data: { assistant_candidate_id: string }) => void;
      onTtsError?: (data: { code: string; message: string }) => void;
      onError: (error: Error) => void;
    },
  ): Promise<void> {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      };

      const response = await fetchWithBetterAuth(`/v1/turns/${turnId}/edit/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
        signal: handlers.signal,
      });

      if (!response.ok) {
        return throwApiErrorResponse(response);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let pending = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        pending += decoder.decode(value, { stream: true });
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const payload = trimmed.slice(5).trim();
          if (!payload) continue;

          try {
            const data = JSON.parse(payload) as TurnStreamEvent;
            if (data.type === "meta") {
              handlers.onMeta?.(data);
            } else if (data.type === "chunk") {
              handlers.onChunk(data.content);
            } else if (data.type === "transform_done") {
              handlers.onTransformDone?.({
                original_content: data.original_content,
                transformed_content: data.transformed_content,
                applied: data.applied,
              });
            } else if (data.type === "done") {
              handlers.onDone(
                data.full_content,
                data.assistant_turn_id,
                data.assistant_candidate_id,
              );
            } else if (data.type === "reply_suggestions") {
              handlers.onReplySuggestions?.({
                assistant_candidate_id: data.assistant_candidate_id,
                suggestions: data.suggestions,
              });
            } else if (data.type === "reply_card_started") {
              handlers.onReplyCardStarted?.({
                assistant_candidate_id: data.assistant_candidate_id,
              });
            } else if (data.type === "reply_card") {
              handlers.onReplyCard?.({
                assistant_candidate_id: data.assistant_candidate_id,
                reply_card: data.reply_card,
              });
            } else if (data.type === "reply_card_error") {
              handlers.onReplyCardError?.({
                assistant_candidate_id: data.assistant_candidate_id,
                code: data.code,
                message: data.message,
              });
            } else if (data.type === "tts_audio_delta") {
              handlers.onTtsAudioDelta?.({
                assistant_candidate_id: data.assistant_candidate_id,
                seq: data.seq,
                audio_b64: data.audio_b64,
                mime_type: data.mime_type,
              });
            } else if (data.type === "tts_audio_done") {
              handlers.onTtsAudioDone?.({
                assistant_candidate_id: data.assistant_candidate_id,
              });
            } else if (data.type === "tts_error") {
              handlers.onTtsError?.({
                code: data.code,
                message: data.message,
              });
            } else if (data.type === "error") {
              if (data.code && data.message) {
                handlers.onError(new Error(`${data.code}: ${data.message}`));
              } else {
                handlers.onError(new Error(data.message || "Unknown error"));
              }
            }
          } catch {
            // Ignore malformed stream rows.
          }
        }
      }
    } catch (error) {
      if (
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        return;
      }

      if (error instanceof UnauthorizedError) {
        handlers.onError(new Error(getErrorMessage(error)));
        return;
      }

      if (error instanceof ApiError) {
        handlers.onError(new Error(error.detail || `API error: ${error.status}`));
        return;
      }

      handlers.onError(
        error instanceof Error ? error : new Error("Unknown error"),
      );
    }
  }

  async streamChatMessage(
    chatId: string,
    request: ChatStreamRequest,
    handlers: {
      signal?: AbortSignal;
      onMeta?: (meta: ChatStreamMetaEvent) => void;
      onChatTitleUpdated?: (data: { chat_id: string; title: string }) => void;
      onTransformChunk?: (content: string) => void;
      onTransformDone?: (data: {
        original_content: string;
        transformed_content: string;
        applied: boolean;
      }) => void;
      onChunk: (content: string) => void;
      onDone: (
        fullContent: string,
        assistantTurnId?: string,
        assistantCandidateId?: string,
      ) => void;
      onReplySuggestions?: (data: {
        assistant_candidate_id: string;
        suggestions: ReplySuggestion[];
      }) => void;
      onReplyCardStarted?: (data: {
        assistant_candidate_id: string;
      }) => void;
      onReplyCard?: (data: {
        assistant_candidate_id: string;
        reply_card: ReplyCard;
      }) => void;
      onReplyCardError?: (data: {
        assistant_candidate_id: string;
        code: string;
        message: string;
      }) => void;
      // Phase 2: TTS realtime callbacks
      onTtsAudioDelta?: (data: {
        assistant_candidate_id: string;
        seq: number;
        audio_b64: string;
        mime_type: string;
      }) => void;
      onTtsAudioDone?: (data: { assistant_candidate_id: string }) => void;
      onTtsError?: (data: { code: string; message: string }) => void;
      // Phase 5: Growth SSE callbacks
      onGrowthDailyUpdated?: (data: { today: GrowthTodaySummary }) => void;
      onGrowthShareCardReady?: (data: { share_card: GrowthShareCard }) => void;
      onError: (error: Error) => void;
    },
  ): Promise<void> {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      };

      const response = await fetchWithBetterAuth(`/v1/chats/${chatId}/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
        signal: handlers.signal,
      });

      if (!response.ok) {
        return throwApiErrorResponse(response);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let pending = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        pending += decoder.decode(value, { stream: true });
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const payload = trimmed.slice(5).trim();
          if (!payload) continue;

          try {
            const data = JSON.parse(payload) as ChatStreamEvent;
            if (data.type === "meta") {
              handlers.onMeta?.(data);
            } else if (data.type === "chat_title_updated") {
              handlers.onChatTitleUpdated?.({
                chat_id: data.chat_id,
                title: data.title,
              });
            } else if (data.type === "transform_chunk") {
              handlers.onTransformChunk?.(data.content);
            } else if (data.type === "transform_done") {
              handlers.onTransformDone?.({
                original_content: data.original_content,
                transformed_content: data.transformed_content,
                applied: data.applied,
              });
            } else if (data.type === "chunk") {
              handlers.onChunk(data.content);
            } else if (data.type === "done") {
              handlers.onDone(
                data.full_content,
                data.assistant_turn_id,
                data.assistant_candidate_id,
              );
            } else if (data.type === "reply_suggestions") {
              handlers.onReplySuggestions?.({
                assistant_candidate_id: data.assistant_candidate_id,
                suggestions: data.suggestions,
              });
            } else if (data.type === "reply_card_started") {
              handlers.onReplyCardStarted?.({
                assistant_candidate_id: data.assistant_candidate_id,
              });
            } else if (data.type === "reply_card") {
              handlers.onReplyCard?.({
                assistant_candidate_id: data.assistant_candidate_id,
                reply_card: data.reply_card,
              });
            } else if (data.type === "reply_card_error") {
              handlers.onReplyCardError?.({
                assistant_candidate_id: data.assistant_candidate_id,
                code: data.code,
                message: data.message,
              });
            } else if (data.type === "error") {
              if (data.code && data.message) {
                handlers.onError(new Error(`${data.code}: ${data.message}`));
              } else {
                handlers.onError(new Error(data.message || "Unknown error"));
              }
            } else if (data.type === "tts_audio_delta") {
              handlers.onTtsAudioDelta?.({
                assistant_candidate_id: data.assistant_candidate_id,
                seq: data.seq,
                audio_b64: data.audio_b64,
                mime_type: data.mime_type,
              });
            } else if (data.type === "tts_audio_done") {
              handlers.onTtsAudioDone?.({
                assistant_candidate_id: data.assistant_candidate_id,
              });
            } else if (data.type === "tts_error") {
              handlers.onTtsError?.({
                code: data.code,
                message: data.message,
              });
            } else if (data.type === "growth_daily_updated") {
              handlers.onGrowthDailyUpdated?.({ today: data.today });
            } else if (data.type === "growth_share_card_ready") {
              handlers.onGrowthShareCardReady?.({ share_card: data.share_card });
            }
            // memory_queued is silently ignored (background operation)
          } catch {
            // Ignore malformed stream rows.
          }
        }
      }
    } catch (error) {
      if (
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        return;
      }

      if (error instanceof UnauthorizedError) {
        handlers.onError(new Error(getErrorMessage(error)));
        return;
      }

      if (error instanceof ApiError) {
        handlers.onError(new Error(error.detail || `API error: ${error.status}`));
        return;
      }

      handlers.onError(
        error instanceof Error ? error : new Error("Unknown error"),
      );
    }
  }

  async manageMemories(
    request: MemoryManageRequest,
  ): Promise<{ added_ids: number[]; success: boolean }> {
    return httpClient.post("/v1/memories/manage", request);
  }

  async createSavedItem(payload: SavedItemPayload): Promise<SavedItemResponse> {
    return httpClient.post<SavedItemResponse>("/v1/saved-items", {
      saved_item: payload,
    });
  }

  async listSavedItems(params?: {
    kind?: string;
    role_id?: string;
    chat_id?: string;
    cursor?: string;
    limit?: number;
  }, options: ApiRequestOptions = {}): Promise<SavedItemsPage> {
    const qs = new URLSearchParams();
    if (params?.kind) qs.set("kind", params.kind);
    if (params?.role_id) qs.set("role_id", params.role_id);
    if (params?.chat_id) qs.set("chat_id", params.chat_id);
    if (params?.cursor) qs.set("cursor", params.cursor);
    if (params?.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return httpClient.get<SavedItemsPage>(`/v1/saved-items${suffix}`, options);
  }

  async deleteSavedItem(id: string): Promise<void> {
    await httpClient.delete(`/v1/saved-items/${id}`);
  }

  async searchMemories(
    request: MemorySearchRequest,
  ): Promise<{ episodic: unknown[]; semantic: unknown[] }> {
    return httpClient.post("/v1/memories/search", request);
  }

  // Phase 2: STT transcription
  async sttTranscribe(
    audioBlob: Blob,
    options?: { audio_format?: string; sample_rate?: number },
  ): Promise<STTTranscriptionResult> {
    const formData = new FormData();
    const fileName = options?.audio_format === "wav" ? "recording.wav" : "recording.webm";
    formData.append("audio", audioBlob, fileName);
    if (options?.audio_format) {
      formData.append("audio_format", options.audio_format);
    }
    if (options?.sample_rate) {
      formData.append("sample_rate", String(options.sample_rate));
    }

    const response = await fetchWithBetterAuth("/v1/voice/stt/transcriptions", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      if (response.status === 422) {
        const errorData = (await parseJsonResponse(response)) as {
          code?: string;
          message?: string;
          detail?: string;
        } | undefined;
        const errorMessage =
          errorData?.message ||
          errorData?.detail ||
          `HTTP error! status: ${response.status}`;
        throw new ApiError(422, errorData?.code ?? "no_speech", errorMessage);
      }
      return throwApiErrorResponse(response);
    }

    const payload = await parseJsonResponse(response);
    return unwrapEnvelopePayload<STTTranscriptionResult>(payload);
  }

  // Phase 2: TTS single-message audio stream
  async getTtsAudioStream(
    assistantCandidateId: string,
    options?: { audio_format?: "opus" | "mp3"; signal?: AbortSignal },
  ): Promise<ArrayBuffer> {
    const format = options?.audio_format ?? "opus";
    const response = await fetchWithBetterAuth(
      `/v1/voice/tts/messages/${assistantCandidateId}/audio?audio_format=${format}`,
      {
        method: "GET",
        signal: options?.signal,
      },
    );

    if (!response.ok) {
      return throwApiErrorResponse(response);
    }

    return response.arrayBuffer();
  }

  async createRealtimeSession(
    request: RealtimeSessionCreateRequest,
    options?: { signal?: AbortSignal },
  ): Promise<RealtimeSessionCreateResponse> {
    const response = await fetchWithBetterAuth("/v1/realtime/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request),
      signal: options?.signal,
    });

    if (!response.ok) {
      return throwApiErrorResponse(response);
    }

    const payload = await parseJsonResponse(response);
    return unwrapEnvelopePayload<RealtimeSessionCreateResponse>(payload);
  }

  async getRealtimeIceConfig(options?: {
    signal?: AbortSignal;
  }): Promise<RealtimeIceConfigResponse> {
    const response = await fetchWithBetterAuth("/v1/realtime/config", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: options?.signal,
    });

    if (!response.ok) {
      return throwApiErrorResponse(response);
    }

    const payload = await parseJsonResponse(response);
    return unwrapEnvelopePayload<RealtimeIceConfigResponse>(payload);
  }

  async deleteRealtimeSession(
    sessionId: string,
    options?: { signal?: AbortSignal },
  ): Promise<void> {
    const response = await fetchWithBetterAuth(`/v1/realtime/session/${sessionId}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
      signal: options?.signal,
    });

    if (!response.ok) {
      return throwApiErrorResponse(response);
    }
  }

  // Phase 2.1: Voice APIs
  async getMyCharacters(
    options: ApiRequestOptions = {},
  ): Promise<CharacterResponse[]> {
    return httpClient.get<CharacterResponse[]>("/v1/characters", options);
  }

  async getSidebarCharacters(
    options: ApiRequestOptions = {},
  ): Promise<CharacterResponse[]> {
    return httpClient.get<CharacterResponse[]>("/v1/chats/characters", options);
  }

  async listMyVoices(params?: {
    status?: VoiceStatus;
    source_type?: VoiceSourceType;
    cursor?: string;
    limit?: number;
  }, options: ApiRequestOptions = {}): Promise<VoiceProfilesPage> {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.source_type) qs.set("source_type", params.source_type);
    if (params?.cursor) qs.set("cursor", params.cursor);
    if (params?.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return httpClient.get<VoiceProfilesPage>(`/v1/voices${suffix}`, options);
  }

  async listSelectableVoices(params?: {
    provider?: string;
    include_system?: boolean;
    include_user_custom?: boolean;
  }, options: ApiRequestOptions = {}): Promise<VoiceCatalogResponse> {
    const qs = new URLSearchParams();
    if (params?.provider) qs.set("provider", params.provider);
    if (params?.include_system !== undefined) qs.set("include_system", String(params.include_system));
    if (params?.include_user_custom !== undefined) qs.set("include_user_custom", String(params.include_user_custom));
    const suffix = qs.toString() ? `?${qs}` : "";
    return httpClient.get<VoiceCatalogResponse>(
      `/v1/voices/catalog${suffix}`,
      options,
    );
  }

  async createVoiceClone(formData: FormData): Promise<VoiceProfile> {
    const response = await fetchWithBetterAuth("/v1/voices/clones", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      return throwApiErrorResponse(response);
    }

    const payload = await parseJsonResponse(response);
    if (payload && typeof payload === "object" && "data" in payload) {
      const data = (payload as { data: VoiceProfile | { voice?: VoiceProfile } }).data;
      if (data && typeof data === "object" && "voice" in data && data.voice) {
        return data.voice;
      }
      return data as VoiceProfile;
    }
    return payload as VoiceProfile;
  }

  async getVoiceById(
    voiceId: string,
    options: ApiRequestOptions = {},
  ): Promise<VoiceProfile> {
    return httpClient.get<VoiceProfile>(`/v1/voices/${voiceId}`, options);
  }

  async patchVoiceById(
    voiceId: string,
    data: VoiceProfileUpdate,
    options: ApiRequestOptions = {},
  ): Promise<VoiceProfile> {
    return httpClient.patch<VoiceProfile>(
      `/v1/voices/${voiceId}`,
      data,
      options,
    );
  }

  async deleteVoiceById(voiceId: string): Promise<void> {
    await httpClient.delete(`/v1/voices/${voiceId}`);
  }

  async getVoicePreviewAudioStream(
    voiceId: string,
    options?: { audio_format?: "opus" | "mp3"; signal?: AbortSignal },
  ): Promise<ArrayBuffer> {
    const format = options?.audio_format ?? "mp3";
    const response = await fetchWithBetterAuth(
      `/v1/voices/${voiceId}/preview/audio?audio_format=${format}`,
      {
        method: "GET",
        signal: options?.signal,
      },
    );

    if (!response.ok) {
      return throwApiErrorResponse(response);
    }

    return response.arrayBuffer();
  }

  async streamLearningAssistant(
    request: LearningAssistantStreamRequest,
    handlers: {
      signal?: AbortSignal;
      onChunk: (content: string) => void;
      onDone: (fullContent: string) => void;
      onError: (error: Error) => void;
    },
  ): Promise<void> {
    try {
      const response = await fetchWithBetterAuth("/v1/learning/assistant/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(request),
        signal: handlers.signal,
      });

      if (!response.ok) {
        return throwApiErrorResponse(response);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let pending = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        pending += decoder.decode(value, { stream: true });
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const payload = trimmed.slice(5).trim();
          if (!payload) continue;

          try {
            const data = JSON.parse(payload) as LearningAssistantStreamEvent;
            if (data.type === "chunk") {
              handlers.onChunk(data.content);
            } else if (data.type === "done") {
              handlers.onDone(data.full_content);
            } else if (data.type === "error") {
              handlers.onError(
                new ApiError(
                  500,
                  data.code ?? "llm_service_error",
                  data.message ?? "Unknown error",
                ),
              );
            }
          } catch {
            // Ignore malformed stream rows.
          }
        }
      }
    } catch (error) {
      if (
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        return;
      }

      if (error instanceof UnauthorizedError) {
        handlers.onError(new Error(getErrorMessage(error)));
        return;
      }

      if (error instanceof ApiError) {
        handlers.onError(error);
        return;
      }

      handlers.onError(
        error instanceof Error ? error : new Error("Unknown error"),
      );
    }
  }

  async createWordCard(
    request: WordCardGenerateRequest,
  ): Promise<{ word_card: WordCard }> {
    return httpClient.post<{ word_card: WordCard }>("/v1/learning/word-card", request);
  }

  async createReplyCard(
    candidateId: string,
  ): Promise<{ reply_card: ReplyCard }> {
    return httpClient.post<{ reply_card: ReplyCard }>(
      `/v1/learning/reply-card/candidates/${candidateId}`,
      {},
    );
  }

  async createFeedbackCard(
    turnId: string,
  ): Promise<{ feedback_card: FeedbackCard }> {
    return httpClient.post<{ feedback_card: FeedbackCard }>(
      `/v1/turns/${turnId}/feedback-card`,
      {},
    );
  }

  async createSavedItemPhase3(
    payload: SavedItemPayloadPhase3,
  ): Promise<SavedItemResponsePhase3> {
    return httpClient.post<SavedItemResponsePhase3>("/v1/saved-items", {
      saved_item: payload,
    });
  }

  async listSavedItemsPhase3(params?: {
    kind?: SavedItemKindPhase3;
    role_id?: string;
    chat_id?: string;
    cursor?: string;
    limit?: number;
  }, options: ApiRequestOptions = {}): Promise<SavedItemsPagePhase3> {
    const qs = new URLSearchParams();
    if (params?.kind) qs.set("kind", params.kind);
    if (params?.role_id) qs.set("role_id", params.role_id);
    if (params?.chat_id) qs.set("chat_id", params.chat_id);
    if (params?.cursor) qs.set("cursor", params.cursor);
    if (params?.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return httpClient.get<SavedItemsPagePhase3>(
      `/v1/saved-items${suffix}`,
      options,
    );
  }

}

export const apiService = new ApiService();

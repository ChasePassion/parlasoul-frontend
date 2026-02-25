import { httpClient } from "./http-client";
import { ApiError, tokenStore, UnauthorizedError } from "./token-store";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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
  avatar_url?: string;
  created_at: string;
  last_login_at?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface SendCodeRequest {
  email: string;
}

export interface LoginRequest {
  email: string;
  code: string;
}

export interface UpdateProfileRequest {
  username?: string;
  avatar_url?: string;
}

export type DisplayMode = "concise" | "detailed";

export interface UserSettingsResponse {
  display_mode: DisplayMode;
  knowledge_card_enabled: boolean;
  mixed_input_auto_translate_enabled: boolean;
  message_font_size: number;
  updated_at: string;
}

export interface UpdateUserSettingsRequest {
  display_mode?: DisplayMode;
  knowledge_card_enabled?: boolean;
  mixed_input_auto_translate_enabled?: boolean;
  message_font_size?: number;
}

export type CharacterVisibility = "PUBLIC" | "PRIVATE" | "UNLISTED";
export type ChatVisibility = CharacterVisibility;
export type ChatState = "ACTIVE" | "ARCHIVED";
export type ChatType = "ONE_ON_ONE" | "ROOM";
export type TurnAuthorType = "USER" | "CHARACTER" | "SYSTEM";
export type TurnState = "OK" | "FILTERED" | "DELETED" | "ERROR";

export interface CreateCharacterRequest {
  name: string;
  description: string;
  system_prompt: string;
  greeting_message?: string;
  avatar_file_name?: string;
  tags?: string[];
  visibility?: CharacterVisibility;
}

export interface CharacterResponse {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  greeting_message?: string;
  avatar_file_name?: string;
  tags?: string[];
  creator_id: string;
  visibility: CharacterVisibility;
  identifier?: string;
  interaction_count: number;
}

export interface CharacterBrief {
  id: string;
  name: string;
  description: string;
  greeting_message?: string;
  avatar_file_name?: string;
  tags?: string[];
  visibility: CharacterVisibility;
  creator_id?: string | null;
  interaction_count: number;
}

export interface ChatResponse {
  id: string;
  user_id: string;
  character_id: string;
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

export interface SentenceCardPhrase {
  surface: string;
  zh: string;
  ipa_us: string;
}

export interface SentenceCardFavoriteState {
  enabled: boolean;
  is_favorited: boolean;
  saved_item_id?: string | null;
}

export interface SentenceCard {
  surface: string;
  zh: string;
  key_phrases: SentenceCardPhrase[];
  favorite: SentenceCardFavoriteState;
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

export interface SavedItemSource {
  role_id: string;
  chat_id: string;
  message_id: string;
  turn_id?: string | null;
  candidate_id?: string | null;
  meta?: Record<string, unknown> | null;
}

export interface SavedItemPayload {
  kind: string;
  display: SavedItemDisplay;
  card: SentenceCard;
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
  sentence_card?: SentenceCard | null;
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
  avatar_file_name?: string;
  tags?: string[];
  visibility?: CharacterVisibility;
}

interface StreamChunkEvent {
  type: "chunk";
  content: string;
}

interface StreamDoneEvent {
  type: "done";
  full_content: string;
}

interface StreamErrorEvent {
  type: "error";
  code?: string;
  message?: string;
}

type StreamEvent = StreamChunkEvent | StreamDoneEvent | StreamErrorEvent;

interface TurnStreamReplySuggestionsEvent {
  type: "reply_suggestions";
  suggestions: ReplySuggestion[];
}

type TurnStreamEvent = StreamEvent | TurnStreamReplySuggestionsEvent;

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
  suggestions: ReplySuggestion[];
}

interface ChatStreamSentenceCardEvent {
  type: "sentence_card";
  message_id: string;
  sentence_card: SentenceCard;
}

interface ChatStreamMemoryQueuedEvent {
  type: "memory_queued";
  status: string;
}

interface ChatStreamErrorEvent {
  type: "error";
  code?: string;
  message?: string;
}

type ChatStreamEvent =
  | ChatStreamMetaEvent
  | ChatStreamTransformChunkEvent
  | ChatStreamTransformDoneEvent
  | ChatStreamChunkEvent
  | ChatStreamDoneEvent
  | ChatStreamReplySuggestionsEvent
  | ChatStreamSentenceCardEvent
  | ChatStreamMemoryQueuedEvent
  | ChatStreamErrorEvent;

export class ApiService {
  async sendVerificationCode(email: string): Promise<void> {
    await httpClient.post("/v1/auth/send_code", { email });
  }

  async login(email: string, code: string): Promise<AuthResponse> {
    const response = await httpClient.post<AuthResponse>("/v1/auth/login", {
      email,
      code,
    });

    tokenStore.setToken(response.access_token);
    return response;
  }

  async getCurrentUser(): Promise<User> {
    return httpClient.get<User>("/v1/auth/me");
  }

  async uploadFile(file: File): Promise<{ url: string }> {
    return httpClient.upload<{ url: string }>("/v1/upload", file);
  }

  async updateUserProfile(data: UpdateProfileRequest): Promise<User> {
    return httpClient.put<User>("/v1/users/me", data);
  }

  async getMySettings(): Promise<UserSettingsResponse> {
    return httpClient.get<UserSettingsResponse>("/v1/users/me/settings");
  }

  async updateMySettings(
    data: UpdateUserSettingsRequest,
  ): Promise<UserSettingsResponse> {
    return httpClient.patch<UserSettingsResponse, UpdateUserSettingsRequest>(
      "/v1/users/me/settings",
      data,
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
  ): Promise<CharacterResponse[]> {
    return httpClient.get<CharacterResponse[]>(
      `/v1/characters/market?skip=${skip}&limit=${limit}`,
    );
  }

  async getCharacterById(id: string): Promise<CharacterResponse> {
    return httpClient.get<CharacterResponse>(`/v1/characters/${id}`);
  }

  async getUserCharacters(
    creatorId: string,
    skip = 0,
    limit = 20,
  ): Promise<CharacterResponse[]> {
    return httpClient.get<CharacterResponse[]>(
      `/v1/users/${creatorId}/characters?skip=${skip}&limit=${limit}`,
    );
  }

  async updateCharacter(
    id: string,
    data: UpdateCharacterRequest,
  ): Promise<CharacterResponse> {
    return httpClient.put<CharacterResponse>(`/v1/characters/${id}`, data);
  }

  async deleteCharacter(id: string): Promise<void> {
    await httpClient.delete(`/v1/characters/${id}`);
  }

  async getRecentChat(characterId: string): Promise<ChatDetailResponse | null> {
    return httpClient.get<ChatDetailResponse | null>(
      `/v1/chats/recent?character_id=${characterId}`,
    );
  }

  async createChat(request: ChatCreateRequest): Promise<ChatCreateResponse> {
    return httpClient.post<ChatCreateResponse, ChatCreateRequest>(
      `/v1/chats`,
      request,
    );
  }

  async getChatTurns(
    chatId: string,
    options: { before_turn_id?: string; limit?: number } = {},
  ): Promise<TurnsPageResponse> {
    const params = new URLSearchParams();
    if (options.before_turn_id)
      params.set("before_turn_id", String(options.before_turn_id));
    params.set("limit", String(options.limit ?? 20));
    const qs = params.toString();
    const suffix = qs ? `?${qs}` : "";
    return httpClient.get<TurnsPageResponse>(
      `/v1/chats/${chatId}/turns${suffix}`,
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
      onChunk: (content: string) => void;
      onDone: (fullContent: string) => void;
      onReplySuggestions?: (suggestions: ReplySuggestion[]) => void;
      onError: (error: string) => void;
    },
  ): Promise<void> {
    try {
      const token = tokenStore.getToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`/v1/turns/${turnId}/regen/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
        signal: handlers.signal,
      });

      if (!response.ok) {
        const errorData: { code?: string; message?: string; detail?: string } =
          await response.json().catch(() => ({}));
        const errorMessage =
          errorData.message ||
          errorData.detail ||
          `HTTP error! status: ${response.status}`;

        if (response.status === 401) {
          tokenStore.clearToken();
          throw new UnauthorizedError(errorMessage);
        }

        throw new ApiError(response.status, errorData.code, errorMessage);
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
            if (data.type === "chunk") {
              handlers.onChunk(data.content);
            } else if (data.type === "done") {
              handlers.onDone(data.full_content);
            } else if (data.type === "reply_suggestions") {
              handlers.onReplySuggestions?.(data.suggestions);
            } else if (data.type === "error") {
              if (data.code && data.message) {
                handlers.onError(`${data.code}: ${data.message}`);
              } else {
                handlers.onError(data.message || "Unknown error");
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
        handlers.onError("Authentication required");
        return;
      }

      if (error instanceof ApiError) {
        handlers.onError(error.detail || `API error: ${error.status}`);
        return;
      }

      handlers.onError(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  async editUserTurnAndStreamReply(
    turnId: string,
    request: UserTurnEditStreamRequest,
    handlers: {
      signal?: AbortSignal;
      onChunk: (content: string) => void;
      onDone: (fullContent: string) => void;
      onReplySuggestions?: (suggestions: ReplySuggestion[]) => void;
      onError: (error: string) => void;
    },
  ): Promise<void> {
    try {
      const token = tokenStore.getToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`/v1/turns/${turnId}/edit/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
        signal: handlers.signal,
      });

      if (!response.ok) {
        const errorData: { code?: string; message?: string; detail?: string } =
          await response.json().catch(() => ({}));
        const errorMessage =
          errorData.message ||
          errorData.detail ||
          `HTTP error! status: ${response.status}`;

        if (response.status === 401) {
          tokenStore.clearToken();
          throw new UnauthorizedError(errorMessage);
        }

        throw new ApiError(response.status, errorData.code, errorMessage);
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
            if (data.type === "chunk") {
              handlers.onChunk(data.content);
            } else if (data.type === "done") {
              handlers.onDone(data.full_content);
            } else if (data.type === "reply_suggestions") {
              handlers.onReplySuggestions?.(data.suggestions);
            } else if (data.type === "error") {
              if (data.code && data.message) {
                handlers.onError(`${data.code}: ${data.message}`);
              } else {
                handlers.onError(data.message || "Unknown error");
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
        handlers.onError("Authentication required");
        return;
      }

      if (error instanceof ApiError) {
        handlers.onError(error.detail || `API error: ${error.status}`);
        return;
      }

      handlers.onError(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  async streamChatMessage(
    chatId: string,
    request: ChatStreamRequest,
    handlers: {
      signal?: AbortSignal;
      onMeta?: (meta: ChatStreamMetaEvent) => void;
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
      onReplySuggestions?: (suggestions: ReplySuggestion[]) => void;
      onSentenceCard?: (data: {
        message_id: string;
        sentence_card: SentenceCard;
      }) => void;
      onError: (error: string) => void;
    },
  ): Promise<void> {
    try {
      const token = tokenStore.getToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`/v1/chats/${chatId}/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
        signal: handlers.signal,
      });

      if (!response.ok) {
        const errorData: { code?: string; message?: string; detail?: string } =
          await response.json().catch(() => ({}));
        const errorMessage =
          errorData.message ||
          errorData.detail ||
          `HTTP error! status: ${response.status}`;

        if (response.status === 401) {
          tokenStore.clearToken();
          throw new UnauthorizedError(errorMessage);
        }

        throw new ApiError(response.status, errorData.code, errorMessage);
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
              handlers.onReplySuggestions?.(data.suggestions);
            } else if (data.type === "sentence_card") {
              handlers.onSentenceCard?.({
                message_id: data.message_id,
                sentence_card: data.sentence_card,
              });
            } else if (data.type === "error") {
              if (data.code && data.message) {
                handlers.onError(`${data.code}: ${data.message}`);
              } else {
                handlers.onError(data.message || "Unknown error");
              }
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
        handlers.onError("Authentication required");
        return;
      }

      if (error instanceof ApiError) {
        handlers.onError(error.detail || `API error: ${error.status}`);
        return;
      }

      handlers.onError(
        error instanceof Error ? error.message : "Unknown error",
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
  }): Promise<SavedItemsPage> {
    const qs = new URLSearchParams();
    if (params?.kind) qs.set("kind", params.kind);
    if (params?.role_id) qs.set("role_id", params.role_id);
    if (params?.chat_id) qs.set("chat_id", params.chat_id);
    if (params?.cursor) qs.set("cursor", params.cursor);
    if (params?.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return httpClient.get<SavedItemsPage>(`/v1/saved-items${suffix}`);
  }

  async deleteSavedItem(id: string): Promise<void> {
    await httpClient.delete(`/v1/saved-items/${id}`);
  }

  async searchMemories(
    request: MemorySearchRequest,
  ): Promise<{ episodic: unknown[]; semantic: unknown[] }> {
    return httpClient.post("/v1/memories/search", request);
  }
}

export const apiService = new ApiService();

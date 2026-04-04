import { httpClient } from "./http-client";
import type {
  GrowthEntryResponse,
  GrowthCalendarResponse,
  GrowthMakeUpResponse,
  GrowthChatHeaderResponse,
  GrowthOverviewResponse,
  GrowthCharactersPageResponse,
  GrowthCharacterSortBy,
  GrowthShareCardsPageResponse,
} from "./growth-types";

// ── 1. Entry (进站弹窗) ──

export async function consumeGrowthEntry(
  req?: { calendar_month?: string },
): Promise<GrowthEntryResponse> {
  return httpClient.post<GrowthEntryResponse>("/v1/growth/entry", req ?? {});
}

// ── 2. Calendar ──

export async function getGrowthCalendar(
  month?: string,
): Promise<GrowthCalendarResponse> {
  const params = new URLSearchParams();
  if (month) params.set("month", month);
  const qs = params.toString();
  return httpClient.get<GrowthCalendarResponse>(
    `/v1/growth/calendar${qs ? `?${qs}` : ""}`,
  );
}

// ── 3. Make-Up ──

export async function applyGrowthMakeUp(
  targetDate: string,
): Promise<GrowthMakeUpResponse> {
  return httpClient.post<GrowthMakeUpResponse>("/v1/growth/make-up", {
    target_date: targetDate,
  });
}

// ── 4. Chat Header Ring ──

export async function getGrowthChatHeader(
  chatId: string,
): Promise<GrowthChatHeaderResponse> {
  return httpClient.get<GrowthChatHeaderResponse>(
    `/v1/growth/chats/${chatId}/header`,
  );
}

// ── 5. Overview ──

export async function getGrowthOverview(
  focusCharacterId?: string,
): Promise<GrowthOverviewResponse> {
  const params = new URLSearchParams();
  if (focusCharacterId) params.set("focus_character_id", focusCharacterId);
  const qs = params.toString();
  return httpClient.get<GrowthOverviewResponse>(
    `/v1/growth/overview${qs ? `?${qs}` : ""}`,
  );
}

// ── 6. Character Ledger ──

export async function listGrowthCharacters(params: {
  cursor?: string;
  limit?: number;
  sort_by?: GrowthCharacterSortBy;
}): Promise<GrowthCharactersPageResponse> {
  const sp = new URLSearchParams();
  if (params.cursor) sp.set("cursor", params.cursor);
  if (params.limit !== undefined) sp.set("limit", String(params.limit));
  if (params.sort_by) sp.set("sort_by", params.sort_by);
  const qs = sp.toString();
  return httpClient.get<GrowthCharactersPageResponse>(
    `/v1/growth/characters${qs ? `?${qs}` : ""}`,
  );
}

// ── 7. Pending Share Cards ──

export async function listPendingShareCards(params: {
  chat_id?: string;
  limit?: number;
}): Promise<GrowthShareCardsPageResponse> {
  const sp = new URLSearchParams();
  if (params.chat_id) sp.set("chat_id", params.chat_id);
  if (params.limit !== undefined) sp.set("limit", String(params.limit));
  const qs = sp.toString();
  return httpClient.get<GrowthShareCardsPageResponse>(
    `/v1/growth/share-cards/pending${qs ? `?${qs}` : ""}`,
  );
}

// ── 8. Consume Share Card ──

export async function consumeShareCard(triggerId: string): Promise<void> {
  await httpClient.post(`/v1/growth/share-cards/${triggerId}/consume`);
}

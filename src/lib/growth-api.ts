import { httpClient } from "./http-client";
import type {
  GrowthEntryResponse,
  GrowthCalendarResponse,
  GrowthMakeUpResponse,
  GrowthChatHeaderResponse,
  GrowthOverviewResponse,
  GrowthShareCardsPageResponse,
} from "./growth-types";

type ApiRequestOptions = {
  signal?: AbortSignal;
};

// ── 1. Entry (进站弹窗) ──

export async function consumeGrowthEntry(
  req?: { calendar_month?: string },
): Promise<GrowthEntryResponse> {
  return httpClient.post<GrowthEntryResponse>("/v1/growth/entry", req ?? {});
}

// ── 2. Calendar ──

export async function getGrowthCalendar(
  month?: string,
  options: ApiRequestOptions = {},
): Promise<GrowthCalendarResponse> {
  const params = new URLSearchParams();
  if (month) params.set("month", month);
  const qs = params.toString();
  return httpClient.get<GrowthCalendarResponse>(
    `/v1/growth/calendar${qs ? `?${qs}` : ""}`,
    options,
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
  options: ApiRequestOptions = {},
): Promise<GrowthChatHeaderResponse> {
  return httpClient.get<GrowthChatHeaderResponse>(
    `/v1/growth/chats/${chatId}/header`,
    options,
  );
}

// ── 5. Overview ──

export async function getGrowthOverview(
  focusCharacterId?: string,
  options: ApiRequestOptions = {},
): Promise<GrowthOverviewResponse> {
  const params = new URLSearchParams();
  if (focusCharacterId) params.set("focus_character_id", focusCharacterId);
  const qs = params.toString();
  return httpClient.get<GrowthOverviewResponse>(
    `/v1/growth/overview${qs ? `?${qs}` : ""}`,
    options,
  );
}

// ── 6. Pending Share Cards ──

export async function listPendingShareCards(params: {
  chat_id?: string;
  limit?: number;
}, options: ApiRequestOptions = {}): Promise<GrowthShareCardsPageResponse> {
  const sp = new URLSearchParams();
  if (params.chat_id) sp.set("chat_id", params.chat_id);
  if (params.limit !== undefined) sp.set("limit", String(params.limit));
  const qs = sp.toString();
  return httpClient.get<GrowthShareCardsPageResponse>(
    `/v1/growth/share-cards/pending${qs ? `?${qs}` : ""}`,
    options,
  );
}

// ── 8. Consume Share Card ──

export async function consumeShareCard(triggerId: string): Promise<void> {
  await httpClient.post(`/v1/growth/share-cards/${triggerId}/consume`);
}

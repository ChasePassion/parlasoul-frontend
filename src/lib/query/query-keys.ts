type NullableId = string | null | undefined;

const scopedId = (value: NullableId) => value ?? "anonymous";

export interface CursorPageParams {
  cursor?: string | null;
  limit?: number;
}

export interface OffsetPageParams {
  skip?: number;
  limit?: number;
}

export interface SavedItemListParams extends CursorPageParams {
  kind?: string;
  roleId?: string;
  chatId?: string;
}

export interface VoiceListParams extends CursorPageParams {
  status?: string;
  sourceType?: string;
}

export interface VoiceCatalogParams {
  provider?: string;
  includeSystem?: boolean;
  includeUserCustom?: boolean;
}

export interface ChatTurnsParams {
  beforeTurnId?: string | null;
  limit?: number;
  includeLearningData?: boolean;
}

export const queryKeys = {
  all: ["parlasoul"] as const,

  auth: {
    all: () => [...queryKeys.all, "auth"] as const,
    entitlements: (userId: NullableId) =>
      [...queryKeys.auth.all(), "entitlements", scopedId(userId)] as const,
  },

  user: {
    all: (userId: NullableId) =>
      [...queryKeys.all, "user", scopedId(userId)] as const,
    profile: (userId: NullableId) =>
      [...queryKeys.user.all(userId), "profile"] as const,
    settings: (userId: NullableId) =>
      [...queryKeys.user.all(userId), "settings"] as const,
  },

  sidebar: {
    characters: (userId: NullableId) =>
      [...queryKeys.all, "sidebar", "characters", scopedId(userId)] as const,
  },

  characters: {
    all: () => [...queryKeys.all, "characters"] as const,
    market: (params: OffsetPageParams = {}) =>
      [
        ...queryKeys.characters.all(),
        "market",
        params.skip ?? 0,
        params.limit ?? 20,
      ] as const,
    marketAll: () => [...queryKeys.characters.all(), "market-all"] as const,
    mine: (userId: NullableId) =>
      [...queryKeys.characters.all(), "mine", scopedId(userId)] as const,
    detail: (userId: NullableId, characterId: NullableId) =>
      [
        ...queryKeys.characters.all(),
        "detail",
        scopedId(userId),
        characterId ?? "unknown",
      ] as const,
  },

  chats: {
    all: (userId: NullableId) =>
      [...queryKeys.all, "chats", scopedId(userId)] as const,
    recent: (userId: NullableId, characterId: NullableId) =>
      [
        ...queryKeys.chats.all(userId),
        "recent",
        characterId ?? "unknown",
      ] as const,
    history: (userId: NullableId, characterId: NullableId, limit = 20) =>
      [
        ...queryKeys.chats.all(userId),
        "history",
        characterId ?? "unknown",
        limit,
      ] as const,
    turns: (
      userId: NullableId,
      chatId: NullableId,
      params: ChatTurnsParams = {},
    ) =>
      [
        ...queryKeys.chats.all(userId),
        "turns",
        chatId ?? "unknown",
        params.beforeTurnId ?? "latest",
        params.limit ?? 20,
        params.includeLearningData ?? false,
      ] as const,
  },

  savedItems: {
    all: (userId: NullableId) =>
      [...queryKeys.all, "saved-items", scopedId(userId)] as const,
    list: (userId: NullableId, params: SavedItemListParams = {}) =>
      [
        ...queryKeys.savedItems.all(userId),
        params.kind ?? "all",
        params.roleId ?? "all",
        params.chatId ?? "all",
        params.cursor ?? "first",
        params.limit ?? 20,
      ] as const,
  },

  voices: {
    all: (userId: NullableId) =>
      [...queryKeys.all, "voices", scopedId(userId)] as const,
    mine: (userId: NullableId, params: VoiceListParams = {}) =>
      [
        ...queryKeys.voices.all(userId),
        "mine",
        params.status ?? "all",
        params.sourceType ?? "all",
        params.cursor ?? "first",
        params.limit ?? 20,
      ] as const,
    catalog: (userId: NullableId, params: VoiceCatalogParams = {}) =>
      [
        ...queryKeys.voices.all(userId),
        "catalog",
        params.provider ?? "all",
        params.includeSystem ?? true,
        params.includeUserCustom ?? true,
      ] as const,
    detail: (userId: NullableId, voiceId: NullableId) =>
      [
        ...queryKeys.voices.all(userId),
        "detail",
        voiceId ?? "unknown",
      ] as const,
  },

  llm: {
    catalog: () => [...queryKeys.all, "llm", "catalog"] as const,
    search: (modelId: string) =>
      [...queryKeys.all, "llm", "search", modelId] as const,
  },

  growth: {
    all: (userId: NullableId) =>
      [...queryKeys.all, "growth", scopedId(userId)] as const,
    entry: (userId: NullableId) =>
      [...queryKeys.growth.all(userId), "entry"] as const,
    calendar: (userId: NullableId, month?: string | null) =>
      [...queryKeys.growth.all(userId), "calendar", month ?? "current"] as const,
    chatHeader: (userId: NullableId, chatId: NullableId) =>
      [
        ...queryKeys.growth.all(userId),
        "chat-header",
        chatId ?? "unknown",
      ] as const,
    overview: (userId: NullableId, focusCharacterId?: string | null) =>
      [
        ...queryKeys.growth.all(userId),
        "overview",
        focusCharacterId ?? "all",
      ] as const,
    pendingShareCards: (userId: NullableId, chatId?: string | null) =>
      [
        ...queryKeys.growth.all(userId),
        "pending-share-cards",
        chatId ?? "all",
      ] as const,
  },

  billing: {
    all: (userId?: NullableId) =>
      userId === undefined
        ? ([...queryKeys.all, "billing"] as const)
        : ([...queryKeys.all, "billing", scopedId(userId)] as const),
    wechatProducts: () =>
      [...queryKeys.all, "billing", "wechat-products"] as const,
    wechatOrder: (userId: NullableId, orderId: NullableId) =>
      [
        ...queryKeys.billing.all(userId),
        "wechat-order",
        orderId ?? "unknown",
      ] as const,
    wechatOrders: (
      userId: NullableId,
      params: { channel?: string; skip?: number; limit?: number } = {},
    ) =>
      [
        ...queryKeys.billing.all(userId),
        "wechat-orders",
        params.channel ?? "all",
        params.skip ?? 0,
        params.limit ?? 20,
      ] as const,
    dodoSubscriptions: (
      userId: NullableId,
      params: { page?: number; limit?: number; status?: string } = {},
    ) =>
      [
        ...queryKeys.billing.all(userId),
        "dodo-subscriptions",
        params.page ?? 1,
        params.limit ?? 20,
        params.status ?? "all",
      ] as const,
    dodoPayments: (
      userId: NullableId,
      params: { page?: number; limit?: number; status?: string } = {},
    ) =>
      [
        ...queryKeys.billing.all(userId),
        "dodo-payments",
        params.page ?? 1,
        params.limit ?? 20,
        params.status ?? "all",
      ] as const,
  },
} as const;

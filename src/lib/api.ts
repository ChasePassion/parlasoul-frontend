// 重新导出 ApiService 方法，保持向后兼容
import type {
  CreateCheckoutResponse,
  CustomerPortalResponse,
  PaymentItems,
  SubscriptionItems,
} from "@dodopayments/better-auth";

import { apiService } from "./api-service";
import { authClient } from "./auth-client";
import { mapBetterAuthSessionToUser } from "./auth-user-mapper";
import { clearBetterAuthJwt } from "./better-auth-token";

function requireAuthClientData<T>(
  response: { data?: T | null; error?: { message?: string | null } | null },
  fallbackMessage: string,
) {
  if (response.error) {
    throw new Error(response.error.message || fallbackMessage);
  }

  if (!response.data) {
    throw new Error(fallbackMessage);
  }

  return response.data;
}

// 认证相关
export async function sendVerificationCode(email: string): Promise<void> {
  const response = await authClient.emailOtp.sendVerificationOtp({
    email,
    type: "sign-in",
  });

  if (response.error) {
    throw new Error(response.error.message || "验证码发送失败");
  }
}

export async function loginWithCode(
  email: string,
  code: string,
): Promise<void> {
  const response = await authClient.signIn.emailOtp({
    email,
    otp: code,
  });

  if (response.error) {
    throw new Error(response.error.message || "验证码登录失败");
  }

  clearBetterAuthJwt();
}

export async function signInWithGoogle(callbackURL = "/"): Promise<void> {
  const response = await authClient.signIn.social({
    provider: "google",
    callbackURL,
  });

  if (response.error) {
    throw new Error(response.error.message || "Google 登录失败");
  }
}

export async function getCurrentUser() {
  const response = await authClient.getSession();
  if (response.error) {
    throw new Error(response.error.message || "获取用户信息失败");
  }

  const sessionUser = mapBetterAuthSessionToUser(response.data);
  if (!sessionUser) {
    return null;
  }

  return apiService.getMyProfile();
}

export async function createDodoCheckoutSession(params: {
  slug: string;
  referenceId?: string;
}): Promise<CreateCheckoutResponse> {
  const response = await authClient.dodopayments.checkoutSession({
    slug: params.slug,
    referenceId: params.referenceId,
  });

  return requireAuthClientData(response, "创建支付会话失败");
}

export async function createDodoCustomerPortal(): Promise<CustomerPortalResponse> {
  const response = await authClient.dodopayments.customer.portal();
  return requireAuthClientData(response, "打开订阅管理失败");
}

export async function listDodoSubscriptions(params?: {
  page?: number;
  limit?: number;
  status?: "pending" | "active" | "on_hold" | "cancelled" | "failed" | "expired";
}): Promise<SubscriptionItems> {
  const response = await authClient.dodopayments.customer.subscriptions.list({
    query: {
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
      ...(params?.status ? { status: params.status } : {}),
    },
  });

  return requireAuthClientData(response, "获取订阅列表失败");
}

export async function listDodoPayments(params?: {
  page?: number;
  limit?: number;
  status?:
    | "succeeded"
    | "failed"
    | "cancelled"
    | "processing"
    | "requires_customer_action"
    | "requires_merchant_action"
    | "requires_payment_method"
    | "requires_confirmation"
    | "requires_capture"
    | "partially_captured"
    | "partially_captured_and_capturable";
}): Promise<PaymentItems> {
  const response = await authClient.dodopayments.customer.payments.list({
    query: {
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
      ...(params?.status ? { status: params.status } : {}),
    },
  });

  return requireAuthClientData(response, "获取支付记录失败");
}

export const getWechatPaymentProducts = apiService.getWechatPaymentProducts.bind(apiService);
export const createWechatCheckoutSession =
  apiService.createWechatCheckoutSession.bind(apiService);
export const getWechatPaymentOrder = apiService.getWechatPaymentOrder.bind(apiService);
export const listWechatPaymentOrders = apiService.listWechatPaymentOrders.bind(apiService);

// 用户相关
export const uploadFile = apiService.uploadFile.bind(apiService);
export const getMyProfile = apiService.getMyProfile.bind(apiService);
export const updateUserProfile = apiService.updateUserProfile.bind(apiService);
export const getMySettings = apiService.getMySettings.bind(apiService);
export const updateMySettings = apiService.updateMySettings.bind(apiService);
export const getMyEntitlements = apiService.getMyEntitlements.bind(apiService);

// 角色相关
export const createCharacter = apiService.createCharacter.bind(apiService);
export const getMarketCharacters =
  apiService.getMarketCharacters.bind(apiService);
export const getCharacterById = apiService.getCharacterById.bind(apiService);
export const getUserCharacters = apiService.getUserCharacters.bind(apiService);
export const getMyCharacters = apiService.getMyCharacters.bind(apiService);
export const updateCharacter = apiService.updateCharacter.bind(apiService);
export const unpublishCharacter = apiService.unpublishCharacter.bind(apiService);

// 聊天相关
export const listChats = apiService.listChats.bind(apiService);
export const getRecentChat = apiService.getRecentChat.bind(apiService);
export const createChatInstance = apiService.createChat.bind(apiService);
export const updateChat = apiService.updateChat.bind(apiService);
export const deleteChat = apiService.deleteChat.bind(apiService);
export const getChatTurns = apiService.getChatTurns.bind(apiService);
export const streamChatMessage = apiService.streamChatMessage.bind(apiService);
export const selectTurnCandidate =
  apiService.selectTurnCandidate.bind(apiService);
export const selectTurnCandidateWithSnapshot =
  apiService.selectTurnCandidateWithSnapshot.bind(apiService);
export const regenAssistantTurn =
  apiService.regenAssistantTurn.bind(apiService);
export const editUserTurnAndStreamReply =
  apiService.editUserTurnAndStreamReply.bind(apiService);

// 记忆相关
export const manageMemories = apiService.manageMemories.bind(apiService);
export const searchMemories = apiService.searchMemories.bind(apiService);

// 收藏相关
export const createSavedItem = apiService.createSavedItem.bind(apiService);
export const listSavedItems = apiService.listSavedItems.bind(apiService);
export const deleteSavedItem = apiService.deleteSavedItem.bind(apiService);

// Phase 2: 语音相关
export const sttTranscribe = apiService.sttTranscribe.bind(apiService);
export const getTtsAudioStream = apiService.getTtsAudioStream.bind(apiService);
export const getRealtimeIceConfig = apiService.getRealtimeIceConfig.bind(apiService);
export const createRealtimeSession = apiService.createRealtimeSession.bind(apiService);
export const deleteRealtimeSession = apiService.deleteRealtimeSession.bind(apiService);

// Phase 2.1: 音色相关
export const getSidebarCharacters = apiService.getSidebarCharacters.bind(apiService);
export const listMyVoices = apiService.listMyVoices.bind(apiService);
export const listSelectableVoices = apiService.listSelectableVoices.bind(apiService);
export const createVoiceClone = apiService.createVoiceClone.bind(apiService);
export const getVoiceById = apiService.getVoiceById.bind(apiService);
export const patchVoiceById = apiService.patchVoiceById.bind(apiService);
export const deleteVoiceById = apiService.deleteVoiceById.bind(apiService);
export const getVoicePreviewAudioStream =
  apiService.getVoicePreviewAudioStream.bind(apiService);

// Phase 3: Learning相关
export const createWordCard = apiService.createWordCard.bind(apiService);
export const createReplyCard = apiService.createReplyCard.bind(apiService);
export const createFeedbackCard = apiService.createFeedbackCard.bind(apiService);
export const streamLearningAssistant =
  apiService.streamLearningAssistant.bind(apiService);
export const createSavedItemPhase3 = apiService.createSavedItemPhase3.bind(apiService);
export const listSavedItemsPhase3 = apiService.listSavedItemsPhase3.bind(apiService);

// 导出类型和错误类
export * from "./token-store";
export type {
  User,
  ChatMessage,
  ChatDetailResponse,
  ChatCreateRequest,
  ChatCreateResponse,
  TurnsPageResponse,
  ChatStreamRequest,
  ChatResponse,
  ChatHistoryItem,
  ChatsPageResponse,
  ChatUpdateRequest,
  TurnResponse,
  TurnSelectRequest,
  TurnSelectResponse,
  TurnSelectSnapshotResponse,
  UserTurnEditStreamRequest,
  MemoryManageRequest,
  MemorySearchRequest,
  UpdateProfileRequest,
  AvatarUrls,
  UploadImageResult,
  UserSettingsResponse,
  UpdateUserSettingsRequest,
  UserEntitlementTier,
  EffectiveEntitlementSource,
  UserEntitlementFeatures,
  UserEntitlementSettings,
  UserAccessPass,
  UserEntitlementsResponse,
  WechatPaymentProduct,
  WechatPaymentProductListResponse,
  CreateWechatCheckoutSessionResponse,
  PaymentOrderResponse,
  CreateCharacterRequest,
  CharacterResponse,
  CharacterStatus,
  UpdateCharacterRequest,
  CharacterVisibility,
  // Phase 1 types
  DisplayMode,
  ReplyCard,
  ReplyCardPhrase,
  ReplyCardFavoriteState,
  ReplySuggestion,
  InputTransform,
  CandidateExtra,
  SavedItemKind,
  SavedItemDisplay,
  SavedItemSource,
  SavedItemPayload,
  SavedItemResponse,
  SavedItemsPage,
  // Phase 2 types
  STTTranscriptionResult,
  RealtimeSessionDescription,
  RealtimeIceConfigResponse,
  RealtimeSessionCreateRequest,
  RealtimeSessionCreateResponse,
  // Phase 2.1 types
  VoiceStatus,
  VoiceSourceType,
  VoiceSelectableItem,
  VoiceProfile,
  VoiceProfilesPage,
  VoiceCatalogResponse,
  VoiceProfileUpdate,
  // Phase 4 types
  LLMPresetId,
  DialogueStyleId,
  // Phase 3 types
  LearningAssistantContextMessage,
  LearningAssistantStreamRequest,
  WordCard,
  WordCardGenerateRequest,
  WordCardSense,
  WordCardPosGroup,
  WordCardExample,
  WordCardFavoriteState,
  FeedbackCard,
  KeyPhrase,
  SavedItemKindPhase3,
  SavedItemPayloadPhase3,
  SavedItemResponsePhase3,
  SavedItemsPagePhase3,
} from "./api-service";

// 重新导出 ApiService 方法，保持向后兼容
import { apiService } from "./api-service";

// 认证相关
export const sendVerificationCode =
  apiService.sendVerificationCode.bind(apiService);
export const loginWithCode = apiService.login.bind(apiService);
export const getCurrentUser = apiService.getCurrentUser.bind(apiService);

// 用户相关
export const uploadFile = apiService.uploadFile.bind(apiService);
export const updateUserProfile = apiService.updateUserProfile.bind(apiService);
export const getMySettings = apiService.getMySettings.bind(apiService);
export const updateMySettings = apiService.updateMySettings.bind(apiService);

// 角色相关
export const createCharacter = apiService.createCharacter.bind(apiService);
export const getMarketCharacters =
  apiService.getMarketCharacters.bind(apiService);
export const getCharacterById = apiService.getCharacterById.bind(apiService);
export const getUserCharacters = apiService.getUserCharacters.bind(apiService);
export const getMyCharacters = apiService.getMyCharacters.bind(apiService);
export const updateCharacter = apiService.updateCharacter.bind(apiService);
export const deleteCharacter = apiService.deleteCharacter.bind(apiService);

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

// Phase 4: LLM模型相关
export const getLLMModelCatalog = apiService.getLLMModelCatalog.bind(apiService);
export const searchLLMModels = apiService.searchLLMModels.bind(apiService);

// Phase 3: Learning相关
export const createWordCard = apiService.createWordCard.bind(apiService);
export const createReplyCard = apiService.createReplyCard.bind(apiService);
export const createFeedbackCard = apiService.createFeedbackCard.bind(apiService);
export const createSavedItemPhase3 = apiService.createSavedItemPhase3.bind(apiService);
export const listSavedItemsPhase3 = apiService.listSavedItemsPhase3.bind(apiService);

// 导出类型和错误类
export * from "./token-store";
export type {
  User,
  AuthResponse,
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
  UserSettingsResponse,
  UpdateUserSettingsRequest,
  CreateCharacterRequest,
  CharacterResponse,
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
  // Phase 2.1 types
  VoiceStatus,
  VoiceSourceType,
  VoiceSelectableItem,
  VoiceProfile,
  VoiceProfilesPage,
  VoiceCatalogResponse,
  VoiceProfileUpdate,
  // Phase 4 types
  LLMProvider,
  CharacterLLMRoute,
  LLMModelCatalogItem,
  LLMModelCatalogResponse,
  LLMModelSearchResponse,
  // Phase 3 types
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

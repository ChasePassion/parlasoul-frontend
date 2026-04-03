# role-playing 数据契约（当前前端实现）

更新时间：2026-04-03

## 1. 数据来源分层

当前前端代码里的数据来自 5 个层次：

1. 服务端 DTO
   - 定义在 `src/lib/api-service.ts`
2. 前端投影模型
   - 例如 `Character`、`Message`、`VoiceCardDisplay`
3. 本地持久化
   - `access_token`
   - `user_settings_v2`
4. 流式事件
   - 聊天流
   - regen 流
   - edit 流
5. 二进制 / Web Audio 状态
   - TTS 手动播放
   - 实时 TTS
   - 音色试听

## 2. 本地持久化结构

### 2.1 `access_token`

- 存储位置：`localStorage`
- key：`access_token`
- 类型：`string | null`
- 维护者：`src/lib/token-store.ts`

### 2.2 `user_settings_v2`

- 存储位置：`localStorage`
- key：`user_settings_v2`
- 类型：

```ts
{
  messageFontSize: number;
  displayMode: "concise" | "detailed";
  replyCardEnabled: boolean;
  mixedInputAutoTranslateEnabled: boolean;
  autoReadAloudEnabled: boolean;
  preferredExpressionBiasEnabled: boolean;
}
```

- 维护者：`src/lib/user-settings-context.tsx`

## 3. 服务端核心 DTO

### 3.1 鉴权与用户

`User`

- `id`
- `email`
- `username?`
- `avatar_url?`
- `created_at`
- `last_login_at?`

`AuthResponse`

- `access_token`
- `token_type`

`UpdateProfileRequest`

- `username?`
- `avatar_url?`

### 3.2 用户设置

`DisplayMode`

- `concise`
- `detailed`

`UserSettingsResponse`

- `display_mode`
- `reply_card_enabled`
- `mixed_input_auto_translate_enabled`
- `auto_read_aloud_enabled`
- `preferred_expression_bias_enabled`
- `message_font_size`
- `updated_at`

`UpdateUserSettingsRequest`

- 上述字段全部是可选 patch

### 3.3 角色、音色、模型

`CharacterVisibility`

- `PUBLIC`
- `PRIVATE`
- `UNLISTED`

`LLMProvider`

- `deepseek`
- `openrouter`
- `xiaomi`

`VoiceSourceType`

- `system`
- `clone`
- `designed`
- `imported`

`VoiceStatus`

- `creating`
- `processing`
- `ready`
- `failed`
- `deleting`
- `deleted`

`CharacterResponse`

- 基础资料
  - `id`
  - `name`
  - `description`
  - `system_prompt`
  - `greeting_message?`
  - `avatar_file_name?`
  - `tags?`
  - `visibility`
  - `creator_id`
  - `identifier?`
  - `interaction_count`
- 音色绑定
  - `voice_provider`
  - `voice_model`
  - `voice_provider_voice_id`
  - `voice_source_type`
  - `voice?`
- 模型绑定
  - `llm_provider?`
  - `llm_model?`
  - `uses_system_default_llm?`
  - `effective_llm_provider?`
  - `effective_llm_model?`

`CharacterBrief`

- 聊天详情与聊天历史里用的轻量角色结构

`VoiceSelectableItem`

- `id`
- `display_name`
- `source_type`
- `provider`
- `provider_model`
- `provider_voice_id`
- `avatar_file_name?`
- `preview_text?`
- `preview_audio_url`
- `usage_hint`

`VoiceProfile`

- `id`
- `owner_user_id`
- `provider`
- `provider_voice_id`
- `provider_model`
- `source_type`
- `display_name`
- `description`
- `avatar_file_name?`
- `status`
- `provider_status`
- `preview_text?`
- `preview_audio_url`
- `language_tags`
- `metadata`
- `bound_character_count?`
- `bound_character_ids?`
- `created_at`
- `updated_at`

`LLMModelCatalogResponse`

- `default_route`
- `items[]`

`LLMModelCatalogItem`

- `provider`
- `model`
- `label`
- `description`
- `is_default`

### 3.4 聊天

`ChatType`

- `ONE_ON_ONE`
- `ROOM`

`ChatState`

- `ACTIVE`
- `ARCHIVED`

`TurnAuthorType`

- `USER`
- `CHARACTER`
- `SYSTEM`

`TurnState`

- `OK`
- `FILTERED`
- `DELETED`
- `ERROR`

`ChatResponse`

- `id`
- `user_id`
- `character_id`
- `title`
- `type`
- `state`
- `visibility`
- `last_turn_at?`
- `last_turn_id?`
- `last_turn_no?`
- `active_leaf_turn_id?`
- `last_read_turn_no?`
- `created_at`
- `updated_at`
- `archived_at?`
- `meta?`

`CandidateExtra`

- `input_transform?`
- `reply_card?`

`CandidateResponse`

- `id`
- `candidate_no`
- `content`
- `model_type?`
- `is_final`
- `rank?`
- `created_at`
- `extra?`

`TurnResponse`

- `id`
- `turn_no`
- `author_type`
- `state`
- `is_proactive`
- `parent_turn_id?`
- `parent_candidate_id?`
- `primary_candidate`
- `candidate_count`

`TurnsPageResponse`

- `chat`
- `character`
- `turns[]`
- `next_before_turn_id?`
- `has_more`

`ChatHistoryItem`

- `chat`
- `character`

`ChatsPageResponse`

- `items[]`
- `next_cursor?`
- `has_more`

### 3.5 学习辅助与收藏

`ReplySuggestion`

- `type`
  - `relationship | topic | interaction`
- `en`
- `zh`

`ReplyCard`

- `surface`
- `zh`
- `key_phrases[]`
- `favorite`

`WordCard`

- `surface`
- `ipa_us`
- `pos_groups[]`
- `example`
- `favorite`

`FeedbackCard`

- `surface`
- `zh`
- `key_phrases[]`
- `favorite`

`SavedItemKind`

- `reply_card`
- `word_card`
- `feedback_card`

`SavedItemPayloadPhase3`

- `kind`
- `display`
  - `surface`
  - `zh`
- `card`
  - `ReplyCard | WordCard | FeedbackCard`
- `source`
  - `role_id`
  - `chat_id`
  - `message_id`
  - `turn_id?`
  - `candidate_id?`
  - `meta?`

`SavedItemResponsePhase3`

- 上述字段 + `id` + `created_at`

### 3.6 Discover 配置

`DiscoverConfig`

- `hero_character_ids: string[]`

## 4. 流式事件结构

### 4.1 主聊天流

当前前端解析这些事件：

- `meta`
  - `user_turn`
  - `assistant_turn`
- `chat_title_updated`
  - `chat_id`
  - `title`
- `transform_chunk`
  - `content`
- `transform_done`
  - `original_content`
  - `transformed_content`
  - `applied`
- `chunk`
  - `content`
- `done`
  - `full_content`
  - `assistant_turn_id?`
  - `assistant_candidate_id?`
- `reply_suggestions`
- `reply_card_started`
- `reply_card`
- `reply_card_error`
- `error`
- `tts_audio_delta`
- `tts_audio_done`
- `tts_error`

### 4.2 regen / edit 流

共享事件：

- `meta`
- `chunk`
- `done`
- `reply_suggestions`
- `reply_card_started`
- `reply_card`
- `reply_card_error`
- `error`
- `tts_audio_delta`
- `tts_audio_done`
- `tts_error`

仅 edit 流额外有：

- `transform_done`

## 5. 前端投影模型

### 5.1 Sidebar / 角色卡模型

`Character`

- 来自 `CharacterResponse`
- 额外投影：
  - `avatar`
    - 通过 `resolveCharacterAvatarSrc` 解析
  - `creator_username?`
  - 直接带上 `voice` 和 LLM 显示字段

### 5.2 聊天消息模型

`Message`

- `id`
- `role`
  - `user | assistant`
- `content`
- `candidateNo?`
- `candidateCount?`
- `isTemp?`
- `isGreeting?`
- `inputTransform?`
- `replyCard?`
- `replySuggestions?`
- `transformChunks?`
- `assistantTurnId?`
- `assistantCandidateId?`
- `messageStreamStatus?`
  - `idle | streaming | done | error`
- `replyCardStatus?`
  - `idle | loading | ready | error`
- `replyCardErrorCode?`

### 5.3 音色显示模型

`VoiceDisplayInfo`

- 音色选择器使用
- 包含：
  - `displayName`
  - `description`
  - `provider`
  - `providerModel`
  - `providerVoiceId`
  - `sourceType`
  - `previewText`
  - `previewAudioUrl`
  - `isSystem`
  - `status`
  - `boundCharacterCount`

`VoiceCardDisplay`

- 个人中心音色卡片使用
- 额外包含：
  - `statusText`
  - `canPreview`
  - `canDelete`

### 5.4 模型显示模型

`ModelDisplayInfo`

- `id`
- `provider`
- `model`
- `label`
- `description`
- `isDefault`

`ModelGroup`

- `label`
- `provider`
- `models[]`

## 6. 本地 UI 状态模型

### 6.1 收藏与卡片状态

`MessageActionStatus`

- `idle`
- `loading`
- `ready`
- `error`

`FeedbackCardState`

- `status`
- `feedbackCard`
- `pendingOpen`
- `requestId`
- `errorCode?`

`FavoriteToggleHandler`

- 返回：
  - `Promise<string | null>`
  - 或 `string | null | void`

### 6.2 音频状态

`AudioPreviewSnapshot`

- `activeId`
- `phase`
  - `idle | loading | playing`

### 6.3 用户设置本地状态

`SettingsState`

- `messageFontSize`
- `displayMode`
- `replyCardEnabled`
- `mixedInputAutoTranslateEnabled`
- `autoReadAloudEnabled`
- `preferredExpressionBiasEnabled`

## 7. 前端校验约束

### 7.1 setup 页头像

- 类型：
  - `image/jpeg`
  - `image/png`
  - `image/gif`
  - `image/webp`
- 大小上限：`5MB`

### 7.2 角色创建 / 编辑

- `name`
  - 必填
  - 输入框 `maxLength=100`
- `description`
  - 必填
  - 前端额外限制 `<= 35` 字
- `greeting_message`
  - 可选
  - `maxLength=200`
- `system_prompt`
  - 必填
- `tags`
  - 最多 `3` 个
  - 单个最长 `24` 字符
- `visibility`
  - `PUBLIC | UNLISTED | PRIVATE`

### 7.3 音色克隆

- `display_name`
  - 必填
  - 最长 `40`
- `description`
  - 最长 `160`
- `preview_text`
  - 必填
  - 最长 `120`
- `source_audio`
  - 必填
  - 类型：
    - `audio/wav`
    - `audio/mp3`
    - `audio/mpeg`
    - `audio/m4a`
    - `audio/flac`
    - `audio/opus`
  - 大小上限：`10MB`

### 7.4 音色编辑

- `display_name <= 40`
- `description <= 160`
- `preview_text <= 120`

### 7.5 用户设置

- `messageFontSize`
  - 会被 clamp 到 `14 ~ 24`

## 8. 当前前端口径

- 回复卡字段当前口径是 `reply_card`，不是旧文档里的 `sentence_card`。
- 用户设置字段当前口径是 `reply_card_enabled`，不是旧文档里的 `knowledge_card_enabled`。
- 收藏类型当前口径是 `reply_card | word_card | feedback_card`。
- 正式页面当前没有调试路由，因此不存在额外页面特定 DTO。

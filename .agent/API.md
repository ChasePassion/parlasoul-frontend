# parlasoul-frontend API 契约（当前前端实现）

更新时间：2026-04-03

## 1. 基础约定

- 前端默认运行地址：`http://localhost:3001`
- 所有业务请求都走同源路径：
  - `/v1/*`
  - `/uploads/*`
- `next.config.ts` 会把它们 rewrite 到后端 `http://localhost:8000`

鉴权头统一使用：

```text
Authorization: Bearer <access_token>
```

当前请求实现分成两层：

1. `httpClient`
   - 普通 JSON 请求
2. `fetch`
   - SSE
   - `FormData`
   - 二进制音频

`httpClient` 当前自动做这些事：

- 注入 Bearer token
- 解包 `SuccessEnvelope`
- 处理 `204 No Content`
- 在 `401` 时清空本地 token

## 2. 请求客户端分工

### 2.1 走 `httpClient` 的接口

适用场景：

- 常规 `GET / POST / PUT / PATCH / DELETE`
- JSON body
- JSON response

代表接口：

- `/v1/auth/*`
- `/v1/users/*`
- `/v1/characters*`
- `/v1/chats*`
- `/v1/turns/{id}/select*`
- `/v1/learning/*`
- `/v1/saved-items*`
- `/v1/voices*`
- `/v1/llm-models/*`

### 2.2 手写 `fetch` 的接口

#### SSE

- `POST /v1/chats/{chat_id}/stream`
- `POST /v1/turns/{turn_id}/regen/stream`
- `POST /v1/turns/{turn_id}/edit/stream`

#### 表单上传

- `POST /v1/voice/stt/transcriptions`
- `POST /v1/voices/clones`

#### 二进制音频

- `GET /v1/voice/tts/messages/{assistant_candidate_id}/audio`
- `GET /v1/voices/{voice_id}/preview/audio`

## 3. 页面到接口的真实映射

### 3.1 登录与资料

- `POST /v1/auth/send_code`
  - 登录页发送邮箱验证码
- `POST /v1/auth/login`
  - 验证码登录
- `GET /v1/auth/me`
  - `AuthProvider` 初始化用户
- `POST /v1/upload`
  - setup 页头像上传
  - 角色头像上传
  - 音色头像上传
- `PUT /v1/users/me`
  - setup 页保存用户名与头像
- `GET /v1/users/me/settings`
  - 设置 bootstrap
- `PATCH /v1/users/me/settings`
  - 设置同步

### 3.2 Discover 与角色

- `GET /v1/discover/config`
  - 返回 `hero_character_ids`
- `GET /v1/characters/market?skip={skip}&limit={limit}`
  - Discover 拉全量市场角色
  - 当前分页步长：`100`
- `GET /v1/chats/characters`
  - Sidebar 角色列表
- `GET /v1/characters`
  - Profile 页我的角色
- `POST /v1/characters`
  - 创建角色
- `PUT /v1/characters/{character_id}`
  - 编辑角色
- `DELETE /v1/characters/{character_id}`
  - 删除角色
- `GET /v1/llm-models/catalog`
  - 模型选择器加载全量目录

### 3.3 聊天与 turn tree

- `GET /v1/chats/recent?character_id={character_id}`
  - 进入角色时优先取最近聊天
- `POST /v1/chats`
  - recent chat 不存在时创建新会话
- `GET /v1/chats?character_id={character_id}&cursor={cursor}&limit={limit}`
  - 聊天历史分页
  - 当前 `PAGE_SIZE = 20`
- `PATCH /v1/chats/{chat_id}`
  - 重命名聊天
- `DELETE /v1/chats/{chat_id}`
  - 删除聊天
- `GET /v1/chats/{chat_id}/turns?before_turn_id={id}&limit={limit}`
  - 拉当前 active branch snapshot
  - `useChatSession` 当前主加载 `limit = 50`
  - 向上滚动加载旧消息也用 `limit = 50`
- `POST /v1/turns/{turn_id}/select`
  - API 层保留，当前页面主链路不直接调用
- `POST /v1/turns/{turn_id}/select/snapshot?limit={limit}&include_learning_data={bool}`
  - 候选切换后直接刷新 snapshot

### 3.4 学习辅助与收藏

- `POST /v1/learning/reply-card/candidates/{candidate_id}`
  - 助手回复卡补拉
- `POST /v1/learning/word-card`
  - 划词生成单词卡
- `POST /v1/turns/{turn_id}/feedback-card`
  - 用户消息生成 Better Expression
- `POST /v1/saved-items`
  - 收藏 `reply_card / word_card / feedback_card`
- `GET /v1/saved-items?kind={kind}&role_id={id}&chat_id={id}&cursor={cursor}&limit={limit}`
  - 收藏分页
  - Favorites 页当前默认 `limit = 20`
- `DELETE /v1/saved-items/{saved_item_id}`
  - 删除收藏

### 3.5 语音

- `POST /v1/voice/stt/transcriptions`
  - 麦克风录音转文字
- `GET /v1/voice/tts/messages/{assistant_candidate_id}/audio?audio_format=opus|mp3`
  - 单条助手消息手动朗读
  - 当前默认格式：`opus`
- `GET /v1/voices?status={status}&source_type={source_type}&cursor={cursor}&limit={limit}`
  - 我的音色分页
  - Profile 页当前 `limit = 20`
- `GET /v1/voices/catalog?provider={provider}&include_system={bool}&include_user_custom={bool}`
  - 角色编辑弹窗里的音色选择器
- `POST /v1/voices/clones`
  - 创建克隆音色
- `GET /v1/voices/{voice_id}`
  - 音色详情
- `PATCH /v1/voices/{voice_id}`
  - 更新音色名称、描述、头像、试听文本、绑定角色
- `DELETE /v1/voices/{voice_id}`
  - 删除音色
- `GET /v1/voices/{voice_id}/preview/audio?audio_format=mp3|opus`
  - 音色试听
  - 当前默认格式：`mp3`

## 4. API 层已实现但当前页面没有入口的方法

这些方法存在于 `src/lib/api-service.ts`，但正式页面没有直接入口：

- `GET /v1/users/{creator_id}/characters`
- `GET /v1/characters/{character_id}`
- `POST /v1/memories/manage`
- `POST /v1/memories/search`
- `GET /v1/llm-models/search?model_id={model_id}`

## 5. 关键请求结构

### 5.1 用户设置

当前前端实际写入这些字段：

- `display_mode`
- `reply_card_enabled`
- `mixed_input_auto_translate_enabled`
- `auto_read_aloud_enabled`
- `preferred_expression_bias_enabled`
- `message_font_size`

### 5.2 创建 / 编辑角色

`CreateCharacterRequest` / `UpdateCharacterRequest` 当前前端实际使用这些字段：

- `name`
- `description`
- `system_prompt`
- `greeting_message`
- `avatar_file_name`
- `tags`
- `visibility`
- `voice_provider`
- `voice_model`
- `voice_provider_voice_id`
- `voice_source_type`
- `llm_provider`
- `llm_model`

说明：

- clone 音色在提交角色之前，前端会先请求 `GET /v1/voices/{voice_id}`，把真实 provider / model / provider_voice_id 展平到角色请求里。

### 5.3 音色克隆

`POST /v1/voices/clones`

当前前端会发送：

- `display_name`
- `preview_text`
- `source_audio`
- `source_audio_format`
- `description`
- `avatar_file_name`

### 5.4 音色编辑

`PATCH /v1/voices/{voice_id}`

当前前端会发送：

- `display_name`
- `description`
- `avatar_file_name`
- `preview_text`
- `character_ids`

## 6. 关键响应结构

### 6.1 用户设置

`UserSettingsResponse`

- `display_mode: concise | detailed`
- `reply_card_enabled: boolean`
- `mixed_input_auto_translate_enabled: boolean`
- `auto_read_aloud_enabled: boolean`
- `preferred_expression_bias_enabled: boolean`
- `message_font_size: number`
- `updated_at: string`

### 6.2 角色

`CharacterResponse` 当前前端依赖这些字段：

- 基础资料
  - `id`
  - `name`
  - `description`
  - `system_prompt`
  - `greeting_message`
  - `avatar_file_name`
  - `tags`
  - `visibility`
  - `creator_id`
  - `interaction_count`
- 模型
  - `llm_provider`
  - `llm_model`
  - `uses_system_default_llm`
  - `effective_llm_provider`
  - `effective_llm_model`
- 音色
  - `voice_provider`
  - `voice_model`
  - `voice_provider_voice_id`
  - `voice_source_type`
  - `voice`

### 6.3 聊天 snapshot

`GET /v1/chats/{chat_id}/turns` 当前会被映射成前端 `Message[]`，页面重点依赖：

- `chat`
- `character`
- `turns[]`
  - `id`
  - `turn_no`
  - `author_type`
  - `is_proactive`
  - `candidate_count`
  - `primary_candidate`
    - `id`
    - `candidate_no`
    - `content`
    - `is_final`
    - `extra`
      - `input_transform`
      - `reply_card`

### 6.4 收藏

前端当前收藏类型以这 3 个 kind 为准：

- `reply_card`
- `word_card`
- `feedback_card`

不是旧文档里的 `sentence_card`。

## 7. SSE 事件

### 7.1 聊天主流

`POST /v1/chats/{chat_id}/stream` 当前前端会处理：

- `meta`
- `chat_title_updated`
- `transform_chunk`
- `transform_done`
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

说明：

- `memory_queued` 在类型层存在，但当前 UI 静默忽略。

### 7.2 regen / edit 流

`POST /v1/turns/{turn_id}/regen/stream` 和 `POST /v1/turns/{turn_id}/edit/stream` 当前前端会处理：

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

仅 `edit` 流额外处理：

- `transform_done`

## 8. 二进制与 `FormData`

### 8.1 文件上传

- `POST /v1/upload`
  - `multipart/form-data`
  - 前端统一字段名：`file`

### 8.2 STT

- `POST /v1/voice/stt/transcriptions`
  - `multipart/form-data`
  - 字段：
    - `audio`
    - `audio_format`
    - `sample_rate`

### 8.3 音频读取

- 手动朗读与音色试听都返回 `ArrayBuffer`
- 音色试听按钮会把 `ArrayBuffer` 转成 `Blob`
- 聊天页单条 TTS 会走 Web Audio 解码与播放

### 8.4 实时 TTS

- 实时 TTS 不通过单独 HTTP 拉音频
- 由 SSE 里的 `tts_audio_delta` 持续下发
- 当前播放管理器默认期望 realtime 数据是 `audio/pcm;rate=...`

## 9. 当前前端约束

- `searchLLMModels` 已在 API 层实现，但当前 `ModelSelector` 使用的是全量 catalog + 本地搜索。
- 收藏分页与创建收藏同时保留了旧方法和 Phase 3 方法，当前正式页面链路优先使用 Phase 3 的 `reply_card / word_card / feedback_card`。
- 角色进入聊天时，前端总是先调用 `getRecentChat`，只有 recent chat 不存在时才创建新 chat。
- `CreateVoiceCloneModal` 当前不会发送 `provider`、`language_hint`、`idempotency_key` 等旧版文档里出现过的字段。

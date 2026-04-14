# ParlaSoul 系统 API 契约（前后端统一）

更新时间：2026-04-14

## 1. 文档范围

- 本文档描述当前产品真实 HTTP 契约，覆盖两个仓库共同参与的 API 面。
- 这份文档是“系统 API 视角”，因此前后端仓库中的 `.agent/API.md` 保持一致。
- 当前系统的 HTTP 面分成两类：
  - 前端仓库负责：
    - `/api/auth/*`
    - `/api/auth/email-otp-status`
    - `/api/share-card-image`
    - `/api/logs`
  - 后端仓库负责：
    - `/v1/*`
    - `/uploads/*`
    - `/health`
- 旧的“后端邮箱验证码登录接口”已经不在当前代码库里，认证主链路已收敛到 `better-auth`。

## 2. 通用约定

### 2.1 鉴权

- `/api/auth/*`
  - 由前端仓库的 `better-auth` 托管。
  - 以 Cookie 会话为主，前端再按需换取 JWT 给 `/v1/*` 使用。
- `/v1/*`
  - 默认使用 `Authorization: Bearer <better-auth-jwt>`。
  - JWT 由前端 `fetchWithBetterAuth` 自动附加。
- 当前允许“可选鉴权”的后端接口只有：
  - `GET /v1/characters/{character_id}`
  - `GET /v1/users/{creator_id}/characters`
- 当前无需登录即可访问的主要接口：
  - `GET /v1/discover/config`
  - `GET /v1/characters/market`
  - `GET /v1/payments/wechat/products`
  - `POST /v1/webhooks/dodo/subscriptions`
  - `POST /v1/webhooks/dodo/payments`
  - `GET /health`
  - `GET /uploads/*`
  - `GET /api/auth/email-otp-status`
  - `GET /api/share-card-image`

### 2.2 成功响应包裹

`/v1/*` 的 JSON 成功响应统一使用：

```json
{
  "code": "ok",
  "message": "ok",
  "status": 200,
  "data": {}
}
```

说明：

- `201` 仍然沿用同一包裹，只是 `status=201`
- `202` 也沿用同一包裹
- `204 No Content` 不返回包裹体
- 前端 `httpClient` 会自动解包 `data`

### 2.3 错误响应包裹

`/v1/*` 的错误响应统一使用：

```json
{
  "code": "resource_not_found",
  "message": "resource not found: ...",
  "status": 404
}
```

当前通用错误码基线来自后端 `src/core/error_codes.py`：

- `invalid_param`
- `unauthorized`
- `forbidden`
- `resource_not_found`
- `resource_conflict`
- `upload_file_too_large`
- `upload_file_type_not_allowed`
- `validation_failed`
- `too_many_requests`
- `internal_error`
- `external_error`
- `db_connection_error`
- `memory_unavailable`
- `external_timeout`
- `llm_service_error`
- `stt_upstream_error`
- `stt_no_speech_detected`
- `tts_upstream_error`
- `tts_candidate_forbidden`
- `tts_candidate_invalid_author`

### 2.4 特殊响应类型

- SSE：
  - `Content-Type: text/event-stream`
  - 前端当前只解析以 `data:` 开头的行
  - 每一行 payload 都应是 JSON
- 二进制音频：
  - 直接返回音频流，不走成功包裹
- `multipart/form-data`：
  - 上传与音色克隆相关接口使用表单

## 3. 前端仓库拥有的 HTTP 路由

| 路由 | 所有者 | 当前作用 | 备注 |
| --- | --- | --- | --- |
| `ALL /api/auth/*` | 前端 | `better-auth` 认证、会话、JWT、Dodo 托管能力 | 路由由 `src/app/api/auth/[...all]/route.ts` 统一代理；前端通过 `authClient` 调用，而不是手写 URL |
| `GET /api/auth/email-otp-status?email={email}&type={type}` | 前端 | 登录页查询 OTP 邮件投递状态 | `type` 当前主要是 `sign-in` |
| `GET /api/share-card-image?src={url}` | 前端 | 拉取并缓存分享卡远程图片 | 允许 `http/https`，Redis 缓存 7 天 |
| `POST /api/logs` | 前端 | 将前端结构化日志落到本地文件 | 写入 `logs/{module}.log` |

### 3.1 `/api/auth/*` 当前实际承载的能力

当前代码通过 `authClient` 使用这些认证/计费能力：

- 邮箱 OTP 发送与登录
- 邮箱密码注册与登录
- Google 登录
- 会话读取
- JWT/JWKS 暴露
- Dodo checkout / portal / subscriptions / payments

说明：

- 这些具体子路径由 `better-auth` 生成和托管。
- 当前代码不直接手写这些 URL，因此本文档把它们视为一个前端拥有的认证 API 面，而不是手写路由集合。

## 4. 后端仓库拥有的 HTTP 路由

### 4.1 认证与用户

| 方法 | 路径 | 鉴权 | 当前消费者 | 说明 |
| --- | --- | --- | --- | --- |
| `GET` | `/v1/auth/me` | 必需 | 兼容保留 | 返回轻量用户摘要；当前正式前端不直接调用 |
| `GET` | `/v1/users/me` | 必需 | 外部/兼容保留 | 返回完整个人资料 |
| `PUT` | `/v1/users/me` | 必需 | `setup` 页 | 更新 `username`、`avatar_url` |
| `GET` | `/v1/users/me/settings` | 必需 | `UserSettingsProvider` | 懒创建并返回用户设置 |
| `PATCH` | `/v1/users/me/settings` | 必需 | `UserSettingsProvider` | 局部更新设置 |
| `GET` | `/v1/users/me/entitlements` | 必需 | `AuthProvider`、账单/音色权限判断 | 返回订阅与一次性权益汇总 |
| `GET` | `/v1/users/{creator_id}/characters` | 可选 | 当前正式页面未直接使用 | 自己看自己时返回全部角色，其他人只看公开角色 |

### 4.2 Discover 与角色

| 方法 | 路径 | 鉴权 | 当前消费者 | 说明 |
| --- | --- | --- | --- | --- |
| `GET` | `/v1/discover/config` | 无需 | Discover 页 | 返回 `hero_character_ids` |
| `POST` | `/v1/characters` | 必需 | `CreateCharacterModal` | 创建角色 |
| `GET` | `/v1/characters` | 必需 | Profile 页 | 取当前用户角色列表 |
| `GET` | `/v1/characters/market` | 无需 | Discover 页 | 公开角色市场 |
| `GET` | `/v1/characters/{character_id}` | 可选 | 编辑/详情辅助 | 支持公开、Unlisted、创建者访问私有 |
| `PUT` | `/v1/characters/{character_id}` | 必需 | `CreateCharacterModal` 编辑态 | 更新角色 |
| `POST` | `/v1/characters/{character_id}/unpublish` | 必需 | Profile 页 | 下架角色，已有关联聊天保留为只读历史 |

### 4.3 聊天树与 Turn Tree

| 方法 | 路径 | 鉴权 | 当前消费者 | 说明 |
| --- | --- | --- | --- | --- |
| `GET` | `/v1/chats?character_id={id}&cursor={cursor}&limit={limit}` | 必需 | `ChatHistorySidebar` | 当前用户在某个角色下的聊天分页 |
| `GET` | `/v1/chats/recent?character_id={id}` | 必需 | Discover、Sidebar 跳转聊天 | 先取最近 chat，再决定是否创建 |
| `POST` | `/v1/chats` | 必需 | Discover、`ChatHeader` 新建聊天 | `character_id` 必填 |
| `PATCH` | `/v1/chats/{chat_id}` | 必需 | `ChatHistorySidebar` | 手工改标题 |
| `DELETE` | `/v1/chats/{chat_id}` | 必需 | `ChatHistorySidebar` | 删除 chat |
| `GET` | `/v1/chats/{chat_id}/turns?before_turn_id={id}&limit={limit}&include_learning_data={bool}` | 必需 | `useChatSession` | 读取当前活动分支快照 |
| `POST` | `/v1/chats/{chat_id}/stream` | 必需 | `useChatSession` | 新消息流式生成 |
| `GET` | `/v1/chats/characters` | 必需 | `AppLayout` Sidebar | 仅返回当前用户已有聊天历史的角色 |
| `POST` | `/v1/turns/{turn_id}/select` | 必需 | 当前正式页面未直接使用 | 切换候选，不附带 snapshot |
| `POST` | `/v1/turns/{turn_id}/select/snapshot?limit={limit}&include_learning_data={bool}` | 必需 | `useChatSession` | 切换候选并直接返回最新 snapshot |
| `POST` | `/v1/turns/{turn_id}/regen/stream` | 必需 | `useChatSession` | assistant regen |
| `POST` | `/v1/turns/{turn_id}/edit/stream` | 必需 | `useChatSession` | 用户改写后分叉生成 |
| `POST` | `/v1/turns/{turn_id}/feedback-card` | 必需 | `ChatThread` | 生成 Better Expression |

### 4.4 学习辅助与收藏

| 方法 | 路径 | 鉴权 | 当前消费者 | 说明 |
| --- | --- | --- | --- | --- |
| `POST` | `/v1/learning/word-card` | 必需 | 划词卡片 | 选中文本必须包含英文 |
| `POST` | `/v1/learning/reply-card/candidates/{candidate_id}` | 必需 | 回复卡补拉与重试 | 候选级回复卡 |
| `POST` | `/v1/saved-items` | 必需 | 收藏按钮 | 创建收藏 |
| `GET` | `/v1/saved-items?kind={kind}&role_id={id}&chat_id={id}&cursor={cursor}&limit={limit}` | 必需 | Favorites 页 | 收藏分页 |
| `DELETE` | `/v1/saved-items/{saved_item_id}` | 必需 | Favorites 页、卡片取消收藏 | 删除收藏 |

### 4.5 语音与音色

| 方法 | 路径 | 鉴权 | 当前消费者 | 说明 |
| --- | --- | --- | --- | --- |
| `POST` | `/v1/upload` | 必需 | setup、角色头像、音色头像 | 通用文件上传 |
| `POST` | `/v1/voice/stt/transcriptions` | 必需 | `ChatInput` 麦克风 | STT 转写 |
| `GET` | `/v1/voice/tts/messages/{assistant_candidate_id}/audio?audio_format=opus\|mp3` | 必需 | 单条消息手动朗读 | 二进制音频流 |
| `GET` | `/v1/voices?status={status}&source_type={source_type}&cursor={cursor}&limit={limit}` | 必需 | Profile 音色页 | 我的音色分页 |
| `GET` | `/v1/voices/catalog?provider={provider}&model={model}&include_system={bool}&include_user_custom={bool}` | 必需 | `VoiceSelector` | 角色可选音色目录 |
| `POST` | `/v1/voices/clones` | 必需，且要求 `voice_clone` 权益 | `CreateVoiceCloneModal` | 创建克隆音色，返回 `202 accepted` |
| `GET` | `/v1/voices/{voice_id}/preview/audio?audio_format=opus\|mp3` | 必需 | 音色试听 | 二进制音频流 |
| `GET` | `/v1/voices/{voice_id}` | 必需 | 编辑音色、绑定角色管理 | 详情 |
| `PATCH` | `/v1/voices/{voice_id}` | 必需 | `EditVoiceModal` | 更新元信息和绑定角色 |
| `DELETE` | `/v1/voices/{voice_id}` | 必需 | Profile 音色页 | 删除音色 |

### 4.6 成长系统

| 方法 | 路径 | 鉴权 | 当前消费者 | 说明 |
| --- | --- | --- | --- | --- |
| `POST` | `/v1/growth/entry` | 必需 | `GrowthProvider` | 进站弹窗与签到状态 |
| `GET` | `/v1/growth/calendar?month=YYYY-MM` | 必需 | 签到弹窗 | 日历数据 |
| `POST` | `/v1/growth/make-up` | 必需 | 补签 | 请求体需要 `target_date` |
| `GET` | `/v1/growth/chats/{chat_id}/header` | 必需 | 聊天头部阅读环 | 当前 chat 的阅读等价 |
| `GET` | `/v1/growth/overview?focus_character_id={id}` | 必需 | `/stats` | KPI、趋势、榜单 |
| `GET` | `/v1/growth/characters?cursor={cursor}&limit={limit}&sort_by={sort}` | 必需 | `/stats` 角色台账 | 角色维度排行分页 |
| `GET` | `/v1/growth/share-cards/pending?chat_id={id}&limit={limit}` | 必需 | `GrowthProvider` | 待消费分享卡 |
| `POST` | `/v1/growth/share-cards/{trigger_id}/consume` | 必需 | 分享卡弹窗 | 消费分享卡，`204` |

### 4.7 支付与权益

| 方法 | 路径 | 鉴权 | 当前消费者 | 说明 |
| --- | --- | --- | --- | --- |
| `GET` | `/v1/payments/wechat/products` | 无需 | 定价页 | 微信一次性权益商品目录 |
| `POST` | `/v1/payments/wechat/checkout-session` | 必需 | 定价页 | 创建微信支付 checkout session |
| `GET` | `/v1/payments/orders/{order_id}` | 必需 | 账单页 | 查看单笔一次性订单 |
| `GET` | `/v1/payments/orders?channel={channel}&skip={skip}&limit={limit}` | 必需 | 账单页 | 当前用户订单列表 |

### 4.8 Memory、模型目录、Webhook、基础设施

| 方法 | 路径 | 鉴权 | 当前消费者 | 说明 |
| --- | --- | --- | --- | --- |
| `POST` | `/v1/memories/manage` | 必需 | 当前正式页面未直接使用 | 写入/管理 memory |
| `POST` | `/v1/memories/search` | 必需 | 当前正式页面未直接使用 | memory 搜索 |
| `DELETE` | `/v1/memories/reset` | 必需 | 当前正式页面未直接使用 | 重置角色 memory |
| `POST` | `/v1/memories/consolidate` | 必需 | 当前正式页面未直接使用 | 触发 consolidation |
| `DELETE` | `/v1/memories/{memory_id}?character_id={character_id}` | 必需 | 当前正式页面未直接使用 | 删除 memory |
| `GET` | `/v1/llm-models/catalog` | 必需 | `ModelSelector` | 角色可选模型目录 |
| `GET` | `/v1/llm-models/search?model_id={model_id}` | 必需 | 当前正式页面未直接使用 | 模型精确搜索 |
| `POST` | `/v1/webhooks/dodo/subscriptions` | 无需 | Dodo webhook | 订阅 webhook |
| `POST` | `/v1/webhooks/dodo/payments` | 无需 | Dodo webhook | 一次性支付 webhook |
| `GET` | `/health` | 无需 | 基础设施 | 健康检查 |
| `GET` | `/uploads/{path}` | 无需 | 前端资源访问 | 上传文件静态访问 |

## 5. 关键请求契约

### 5.1 用户资料

`PUT /v1/users/me`

```json
{
  "username": "chase",
  "avatar_url": "/uploads/xxx.jpg"
}
```

规则：

- `username` 长度：`2-50`
- `username` 和 `avatar_url` 至少提供一个

### 5.2 用户设置

`PATCH /v1/users/me/settings`

可写字段：

- `display_mode: "concise" | "detailed"`
- `memory_enabled: boolean`
- `reply_card_enabled: boolean`
- `mixed_input_auto_translate_enabled: boolean`
- `auto_read_aloud_enabled: boolean`
- `preferred_expression_bias_enabled: boolean`
- `message_font_size: number`

当前约束：

- `message_font_size` 范围：`14-24`
- 至少提供一个字段
- `memory_enabled=true` 会经过订阅能力校验

### 5.3 权益

`GET /v1/users/me/entitlements`

关键字段：

- `tier: "free" | "plus" | "pro"`
- `effective_source: "none" | "recurring_subscription" | "one_time_pass"`
- `effective_expires_at: string | null`
- `active_pass`
- `features`
  - `voice_clone: boolean`
  - `memory_feature: boolean`
- `settings`
  - `memory_enabled: boolean`

### 5.4 创建角色

`POST /v1/characters`

```json
{
  "name": "Luna",
  "description": "温柔的英语陪练",
  "system_prompt": "...",
  "greeting_message": "...",
  "avatar_file_name": "/uploads/xxx.jpg",
  "tags": ["陪练", "日常"],
  "visibility": "PUBLIC",
  "voice_provider": "dashscope",
  "voice_model": "qwen3-tts-instruct-flash-realtime",
  "voice_provider_voice_id": "Cherry",
  "voice_source_type": "system",
  "llm_provider": "openrouter",
  "llm_model": "openai/gpt-4.1-mini"
}
```

规则：

- `name`：`1-20`
- `description`：`1-35`
- `tags`：最多 `3` 个，每个 tag 最长 `24`
- `llm_provider` 与 `llm_model` 必须同时出现或同时为 `null`
- `voice_source_type=clone` 时，后端会校验该音色是否属于当前用户且已就绪

### 5.5 更新角色

`PUT /v1/characters/{character_id}`

说明：

- 所有字段可选
- `description` 仍受 `35` 字符上限约束
- 清空角色级 LLM 绑定时，需要同时传 `llm_provider=null` 和 `llm_model=null`

### 5.6 创建聊天

`POST /v1/chats`

```json
{
  "character_id": "uuid",
  "meta": {}
}
```

返回：

- `chat`
- `character`
- `initial_turns`

说明：

- 如果角色有 `greeting_message`，创建 chat 时会预插入 greeting turn

### 5.7 聊天流请求

`POST /v1/chats/{chat_id}/stream`

```json
{
  "content": "hello",
  "client_message_id": "optional"
}
```

规则：

- `content` 必填，最小长度 `1`
- 服务端会先落库 placeholder turns/candidates，再开始 SSE

### 5.8 候选切换

`POST /v1/turns/{turn_id}/select`

```json
{
  "candidate_no": 2
}
```

`POST /v1/turns/{turn_id}/select/snapshot` 复用同一请求体，并附加最新 snapshot。

### 5.9 用户改写流

`POST /v1/turns/{turn_id}/edit/stream`

```json
{
  "content": "new user message"
}
```

语义：

- 不覆盖原 turn
- 在 turn tree 上创建新分支

### 5.10 收藏

`POST /v1/saved-items`

```json
{
  "saved_item": {
    "kind": "reply_card",
    "display": {
      "surface": "How about ...",
      "zh": "要不要..."
    },
    "card": {},
    "source": {
      "role_id": "uuid",
      "chat_id": "uuid",
      "message_id": "string",
      "turn_id": "uuid",
      "candidate_id": "uuid",
      "meta": {}
    }
  }
}
```

当前合法 `kind`：

- `reply_card`
- `word_card`
- `feedback_card`

### 5.11 STT

`POST /v1/voice/stt/transcriptions`

表单字段：

- `audio`
- `audio_format`
  - `pcm | wav | opus | speex | aac | amr`
- `sample_rate`
  - 当前只允许 `8000` 或 `16000`

### 5.12 音色克隆

`POST /v1/voices/clones`

表单字段：

- `provider`
- `display_name`
- `preview_text`
- `source_audio`
- `source_audio_format`
- `description`
- `avatar_file_name`
- `language_hint`
- `idempotency_key`

当前前端正式页面实际发送：

- `display_name`
- `preview_text`
- `source_audio`
- `source_audio_format`
- `description`（可选）
- `avatar_file_name`（可选）

当前前端不会发送：

- `provider`
- `language_hint`
- `idempotency_key`

响应状态：

- `202 Accepted`

响应 `data`：

- `voice`
- `provider_request_id`
- `estimated_ready_seconds`

### 5.13 音色更新

`PATCH /v1/voices/{voice_id}`

可写字段：

- `display_name`
- `description`
- `preview_text`
- `avatar_file_name`
- `character_ids`

### 5.14 Growth

关键请求：

- `POST /v1/growth/entry`
  - 可选 `{ "calendar_month": "YYYY-MM" }`
- `POST /v1/growth/make-up`
  - `{ "target_date": "YYYY-MM-DD" }`

关键响应块：

- `today`
- `calendar`
- `kpis`
- `trends`
- `rankings`
- `reading_equivalence`
- `share_cards`

### 5.15 微信一次性支付

`POST /v1/payments/wechat/checkout-session`

```json
{
  "product_id": "..."
}
```

返回：

- `order_id`
- `checkout_url`
- `checkout_session_id`
- `product_id`
- `tier`
- `duration_days`
- `billing_currency`
- `channel`

## 6. 关键响应契约

### 6.1 `GET /v1/chats/{chat_id}/turns`

返回：

- `chat`
- `character`
- `turns[]`
  - `id`
  - `turn_no`
  - `author_type`
  - `state`
  - `is_proactive`
  - `parent_turn_id`
  - `parent_candidate_id`
  - `candidate_count`
  - `primary_candidate`
    - `id`
    - `candidate_no`
    - `content`
    - `is_final`
    - `extra`
      - `input_transform`
      - `reply_card`

### 6.2 `CharacterResponse`

前端当前依赖的重点字段：

- 基础资料：
  - `id`
  - `name`
  - `description`
  - `system_prompt`
  - `greeting_message`
  - `avatar_file_name`
  - `tags`
  - `visibility`
  - `creator_id`
  - `status`
  - `unpublished_at`
  - `interaction_count`
  - `distinct_user_count`
- LLM 路由：
  - `llm_provider`
  - `llm_model`
  - `uses_system_default_llm`
  - `effective_llm_provider`
  - `effective_llm_model`
- 音色绑定：
  - `voice_provider`
  - `voice_model`
  - `voice_provider_voice_id`
  - `voice_source_type`
  - `voice`

### 6.3 `VoiceProfileResponse`

关键字段：

- `id`
- `owner_user_id`
- `provider`
- `provider_voice_id`
- `provider_model`
- `source_type`
- `display_name`
- `description`
- `avatar_file_name`
- `status`
- `provider_status`
- `preview_text`
- `preview_audio_url`
- `language_tags`
- `metadata`
- `bound_character_count`
- `bound_character_ids`

### 6.4 `GrowthOverviewResponse`

关键块：

- `kpis`
- `trends.last_7_days`
- `trends.last_30_days`
- `rankings.by_messages`
- `rankings.by_words`
- `rankings.by_chatted_days`
- `reading_equivalence`

### 6.5 `PaymentOrderResponse`

关键字段：

- `id`
- `status`
- `product_id`
- `tier`
- `duration_days`
- `channel`
- `billing_currency`
- `paid_at`
- `refunded_at`
- `created_at`
- `charged_total_minor`
- `charged_currency`
- `settlement_total_minor`
- `settlement_currency`

## 7. SSE 事件

### 7.1 `POST /v1/chats/{chat_id}/stream`

当前服务端会发出的事件类型：

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
- `memory_queued`
- `growth_daily_updated`
- `growth_share_card_ready`
- `error`
- `tts_audio_delta`
- `tts_audio_done`
- `tts_error`

当前前端行为：

- `memory_queued` 存在，但 UI 目前静默忽略
- `growth_daily_updated` 会刷新聊天头部/成长上下文
- `growth_share_card_ready` 会进入待展示分享卡队列

### 7.2 `POST /v1/turns/{turn_id}/regen/stream`

当前服务端会发出的事件类型：

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

### 7.3 `POST /v1/turns/{turn_id}/edit/stream`

当前服务端会发出的事件类型：

- `meta`
- `chunk`
- `transform_done`
- `done`
- `reply_suggestions`
- `reply_card_started`
- `reply_card`
- `reply_card_error`
- `error`
- `tts_audio_delta`
- `tts_audio_done`
- `tts_error`

## 8. 当前正式页面到 API 的真实映射

### 8.1 登录、注册、会话与 Setup

- `/login`
  - `authClient` -> `/api/auth/*`
  - `GET /api/auth/email-otp-status`
  - `getCurrentUser()` -> `better-auth` session
- `/setup`
  - `POST /v1/upload`
  - `PUT /v1/users/me`

### 8.2 Discover

- `/`
  - `GET /v1/discover/config`
  - `GET /v1/characters/market`
  - `GET /v1/chats/recent`
  - `POST /v1/chats`

### 8.3 聊天

- `/chat/[id]`
  - `GET /v1/chats/{chat_id}/turns`
  - `POST /v1/chats/{chat_id}/stream`
  - `POST /v1/turns/{turn_id}/regen/stream`
  - `POST /v1/turns/{turn_id}/edit/stream`
  - `POST /v1/turns/{turn_id}/select/snapshot`
  - `GET /v1/chats`
  - `PATCH /v1/chats/{chat_id}`
  - `DELETE /v1/chats/{chat_id}`
  - `POST /v1/learning/reply-card/candidates/{candidate_id}`
  - `POST /v1/learning/word-card`
  - `POST /v1/turns/{turn_id}/feedback-card`
  - `POST /v1/saved-items`
  - `DELETE /v1/saved-items/{saved_item_id}`
  - `POST /v1/voice/stt/transcriptions`
  - `GET /v1/voice/tts/messages/{assistant_candidate_id}/audio`
  - `GET /v1/growth/chats/{chat_id}/header`

### 8.4 收藏

- `/favorites`
  - `GET /v1/saved-items`
  - `DELETE /v1/saved-items/{saved_item_id}`

### 8.5 个人中心

- `/profile`
  - `GET /v1/characters`
  - `POST /v1/characters`
  - `PUT /v1/characters/{character_id}`
  - `POST /v1/characters/{character_id}/unpublish`
  - `GET /v1/voices`
  - `GET /v1/voices/catalog`
  - `POST /v1/voices/clones`
  - `GET /v1/voices/{voice_id}`
  - `PATCH /v1/voices/{voice_id}`
  - `DELETE /v1/voices/{voice_id}`
  - `GET /v1/voices/{voice_id}/preview/audio`
  - `GET /v1/llm-models/catalog`

### 8.6 定价与账单

- `/pricing`
  - `better-auth + Dodo` checkout
  - `GET /v1/payments/wechat/products`
  - `POST /v1/payments/wechat/checkout-session`
- `/billing`
  - `GET /v1/users/me/entitlements`
  - `GET /v1/payments/orders`
  - `GET /v1/payments/orders/{order_id}`
  - `better-auth + Dodo` portal / subscriptions / payments

### 8.7 Growth / Stats

- `/stats`
  - `GET /v1/growth/overview`
  - `GET /v1/growth/characters`
- 全局成长上下文
  - `POST /v1/growth/entry`
  - `GET /v1/growth/share-cards/pending`
  - `POST /v1/growth/share-cards/{trigger_id}/consume`

## 9. 当前已实现但正式页面没有直接入口的接口

- `GET /v1/auth/me`
- `GET /v1/users/me`
- `GET /v1/users/{creator_id}/characters`
- `GET /v1/characters/{character_id}`
- `POST /v1/turns/{turn_id}/select`
- `POST /v1/memories/manage`
- `POST /v1/memories/search`
- `DELETE /v1/memories/reset`
- `POST /v1/memories/consolidate`
- `DELETE /v1/memories/{memory_id}`
- `GET /v1/llm-models/search`

## 10. 当前实现约束

- 认证主链路不再依赖后端自建登录接口，而是前端 `better-auth`。
- 前端进入角色聊天时，总是先 `GET /v1/chats/recent`，只有 recent 不存在时才 `POST /v1/chats`。
- 收藏主链路以 `reply_card / word_card / feedback_card` 为准，不再使用旧的 `sentence_card / knowledge_card`。
- `VoiceSelector` 当前使用 `GET /v1/voices/catalog` 全量目录，再在前端本地筛选。
- `ModelSelector` 当前使用 `GET /v1/llm-models/catalog`，没有走 `search` 接口。
- `CreateVoiceCloneModal` 当前只发送克隆主流程必需字段；后端仍保留 `provider / language_hint / idempotency_key` 扩展位。
- `GET /v1/chats/{chat_id}/turns` 后端默认 `limit=20`，但聊天页当前主链路固定请求 `limit=50`。
- 当前前端通过 `/api/share-card-image` 做远程图片代理和 Redis 缓存；分享卡页面不直接跨域取远程图片。

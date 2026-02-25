# NeuraChar API 文档（当前实现）

本文档基于后端当前代码实现整理（`src/bootstrap/app_factory.py` 挂载的全部路由），用于前后端联调与接口审计。

## 1. 基础信息

- Base URL（本地开发）：`http://localhost:8000`
- OpenAPI JSON：`/v1/openapi.json`
- Swagger UI：`/docs`
- Content-Type：
  - 普通接口：`application/json`
  - 上传接口：`multipart/form-data`
  - 流式接口：`text/event-stream`（SSE）

## 2. 鉴权与请求上下文

- 鉴权方式：`Authorization: Bearer <access_token>`
- Token 获取：`POST /v1/auth/login`
- 鉴权失败：统一 `401`，常见错误码 `auth_token_invalid`
- 需要鉴权的大多数接口会将当前用户注入 DB session 上下文（`app.current_user_id`），用于 RLS/数据隔离（例如 `saved_items`）

## 3. 统一响应规范

### 3.1 成功响应（除 204）

```json
{
  "code": "ok",
  "message": "ok",
  "status": 200,
  "data": {}
}
```

### 3.2 错误响应

```json
{
  "code": "resource_not_found",
  "message": "resource not found: requested resource does not exist",
  "status": 404
}
```

### 3.3 204 响应

- `DELETE /v1/characters/{character_id}`
- `DELETE /v1/saved-items/{saved_item_id}`

均返回 `204 No Content`，无响应体。

## 4. 全量 API 一览

| Method | Path | Auth | 说明 |
|---|---|---|---|
| `GET` | `/health` | No | 服务健康检查 |
| `POST` | `/v1/auth/send_code` | No | 发送邮箱验证码 |
| `POST` | `/v1/auth/login` | No | 验证码登录，返回 token |
| `GET` | `/v1/auth/me` | Yes | 获取当前用户基础信息 |
| `GET` | `/v1/users/me` | Yes | 获取当前用户完整资料 |
| `PUT` | `/v1/users/me` | Yes | 更新当前用户资料 |
| `GET` | `/v1/users/me/settings` | Yes | 获取当前用户设置 |
| `PATCH` | `/v1/users/me/settings` | Yes | 更新当前用户设置 |
| `GET` | `/v1/users/{creator_id}/characters` | Optional | 获取指定创作者角色列表 |
| `POST` | `/v1/characters` | Yes | 创建角色 |
| `GET` | `/v1/characters` | Yes | 获取当前用户角色列表 |
| `GET` | `/v1/characters/market` | No | 获取公开角色市场列表 |
| `GET` | `/v1/characters/{character_id}` | Optional | 获取角色详情（按可见性控制） |
| `PUT` | `/v1/characters/{character_id}` | Yes | 更新角色（仅创建者） |
| `DELETE` | `/v1/characters/{character_id}` | Yes | 删除角色（仅创建者） |
| `POST` | `/v1/upload` | Yes | 上传图片文件 |
| `GET` | `/v1/chats/recent` | Yes | 获取用户在某角色下最近一次 ACTIVE chat |
| `POST` | `/v1/chats` | Yes | 创建 chat（可包含 greeting turn） |
| `GET` | `/v1/chats/{chat_id}/turns` | Yes | 沿当前激活分支分页拉取 turns |
| `POST` | `/v1/chats/{chat_id}/stream` | Yes | 主聊天 SSE 流 |
| `POST` | `/v1/turns/{turn_id}/select` | Yes | 选择某 turn 的候选回复 |
| `POST` | `/v1/turns/{turn_id}/select/snapshot` | Yes | 选择候选并返回快照 |
| `POST` | `/v1/turns/{turn_id}/regen/stream` | Yes | assistant turn 重新生成（SSE） |
| `POST` | `/v1/turns/{turn_id}/edit/stream` | Yes | user turn 编辑后续写（SSE） |
| `POST` | `/v1/saved-items` | Yes | 创建收藏项 |
| `GET` | `/v1/saved-items` | Yes | 分页查询收藏项 |
| `DELETE` | `/v1/saved-items/{saved_item_id}` | Yes | 删除收藏项 |
| `POST` | `/v1/memories/manage` | Yes | 记忆管理 |
| `POST` | `/v1/memories/search` | Yes | 记忆检索 |
| `DELETE` | `/v1/memories/{memory_id}` | Yes | 删除单条记忆（需 character_id query） |
| `DELETE` | `/v1/memories/reset` | Yes | 重置角色维度记忆 |
| `POST` | `/v1/memories/consolidate` | Yes | 记忆归并 |

## 5. 模块说明

### 5.1 Auth

#### `POST /v1/auth/send_code`

请求：

```json
{
  "email": "user@example.com"
}
```

#### `POST /v1/auth/login`

请求：

```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

响应 `data`：

```json
{
  "access_token": "...",
  "token_type": "bearer"
}
```

#### `GET /v1/auth/me`

返回当前登录用户基础资料（`id/email/username/avatar_url/created_at/last_login_at`）。

### 5.2 Users

#### `GET /v1/users/me`

返回当前用户完整资料。

#### `PUT /v1/users/me`

请求体至少包含一个字段：`username` 或 `avatar_url`。

#### `GET /v1/users/me/settings`

返回字段：

```json
{
  "display_mode": "concise",
  "knowledge_card_enabled": true,
  "mixed_input_auto_translate_enabled": true,
  "message_font_size": 16,
  "updated_at": "2026-02-25T00:00:00Z"
}
```

#### `PATCH /v1/users/me/settings`

可更新字段：

- `display_mode`: `concise | detailed`
- `knowledge_card_enabled`: `boolean`
- `mixed_input_auto_translate_enabled`: `boolean`
- `message_font_size`: `14~24`

约束：至少传一个字段，否则 `400 user_settings_update_empty`。

#### `GET /v1/users/{creator_id}/characters`

- Query：`skip`（默认 0）、`limit`（1~100，默认 20）
- 鉴权可选：
  - viewer=creator：返回该 creator 的全部角色
  - 其他：仅返回 PUBLIC

### 5.3 Characters

- `POST /v1/characters`
- `GET /v1/characters`
- `GET /v1/characters/market`
- `GET /v1/characters/{character_id}`
- `PUT /v1/characters/{character_id}`
- `DELETE /v1/characters/{character_id}`

说明：`GET /v1/characters/{character_id}` 为可选鉴权接口，PRIVATE 角色仅创建者可访问。

### 5.4 Upload

#### `POST /v1/upload`

- FormData：`file`
- 允许类型：`image/jpeg,image/png,image/gif,image/webp`
- 大小限制：5MB
- 返回：`{"url":"/uploads/xxx.jpg"}`

### 5.5 Chats（实例 + 主对话流）

#### `GET /v1/chats/recent`

- Query：`character_id`（必填 UUID）
- 返回当前用户在指定角色下最近 ACTIVE chat（可为空）

#### `POST /v1/chats`

请求：

```json
{
  "character_id": "uuid",
  "meta": {}
}
```

#### `GET /v1/chats/{chat_id}/turns`

Query：

- `before_turn_id`（可选）
- `limit`（1~100，默认 20）
- `include_learning_data`（默认 `true`）

说明：

- 返回沿 active branch 的分页快照
- 当 `include_learning_data=false` 时，`candidate.extra` 中的 `input_transform` 与 `sentence_card` 会被剥离

#### `POST /v1/chats/{chat_id}/stream`（SSE）

请求：

```json
{
  "content": "I think 我们可以明天见",
  "client_message_id": "optional-idempotency-key"
}
```

行为概要（实际服务端编排）：

1. 发送 `meta`（返回服务端生成的 turn/candidate id）
2. 如触发混输转写，发送 `transform_done`
3. assistant 逐 token 输出 `chunk`
4. assistant 结束发送 `done`
5. 生成并发送 `reply_suggestions`
6. 若 `knowledge_card_enabled=true` 或 `display_mode=detailed`，发送 `sentence_card`
7. 记忆异步排队后发送 `memory_queued`（可选）

### 5.6 Turns（候选切换 / 重生 / 编辑）

#### `POST /v1/turns/{turn_id}/select`

请求：

```json
{
  "candidate_no": 2
}
```

返回：切换后的 `primary_candidate_id/primary_candidate_no/active_leaf_turn_id` 等。

#### `POST /v1/turns/{turn_id}/select/snapshot`

在 select 的同时返回最新 turns 快照（可用于前端原子切换视图）。

#### `POST /v1/turns/{turn_id}/regen/stream`（SSE）

assistant 候选重生流。事件主序：`meta -> chunk* -> done -> reply_suggestions -> sentence_card?`。

#### `POST /v1/turns/{turn_id}/edit/stream`（SSE）

对 user turn 进行编辑并沿新分支续写 assistant。事件主序：`meta -> chunk* -> done -> reply_suggestions -> sentence_card?`。

### 5.7 Saved Items（收藏）

#### `POST /v1/saved-items`

请求：

```json
{
  "saved_item": {
    "kind": "sentence_card",
    "display": {
      "surface": "That sounds great!",
      "zh": "那听起来很棒！"
    },
    "card": {
      "surface": "That sounds great!",
      "zh": "那听起来很棒！",
      "key_phrases": [
        {"surface": "sounds great", "ipa_us": "/saʊndz ɡreɪt/", "zh": "听起来很棒"}
      ],
      "favorite": {"enabled": true, "is_favorited": true, "saved_item_id": "uuid"}
    },
    "source": {
      "role_id": "uuid",
      "chat_id": "uuid",
      "message_id": "candidate-id",
      "turn_id": "uuid",
      "candidate_id": "uuid"
    }
  }
}
```

说明：

- 唯一键：`(user_id, kind, source_message_id)`
- 重复收藏返回 `409 saved_item_duplicate`
- 服务端会清洗 `card` 顶层 `ipa_us` 与嵌套 `sentence_card.ipa_us`

#### `GET /v1/saved-items`

Query：`kind`、`role_id`、`chat_id`、`cursor`、`limit`

返回：

```json
{
  "items": [],
  "next_cursor": "uuid-or-null",
  "has_more": false
}
```

#### `DELETE /v1/saved-items/{saved_item_id}`

成功返回 204。

### 5.8 Memories

> 当前 memories 全部要求 Bearer 鉴权。

#### `POST /v1/memories/manage`

```json
{
  "character_id": "uuid",
  "chat_id": "uuid",
  "user_text": "...",
  "assistant_text": "..."
}
```

#### `POST /v1/memories/search`

```json
{
  "character_id": "uuid",
  "query": "..."
}
```

返回包含 `episodic[]` 与 `semantic[]`。

#### `DELETE /v1/memories/{memory_id}`

- Path：`memory_id`（int）
- Query：`character_id`（必填）

#### `DELETE /v1/memories/reset`

```json
{
  "character_id": "uuid"
}
```

#### `POST /v1/memories/consolidate`

```json
{
  "character_id": "uuid"
}
```

## 6. SSE 事件合同

### 6.1 `/v1/chats/{chat_id}/stream`

- `meta`
- `transform_done`（仅在混输转写触发时出现）
- `chunk`（可多次）
- `done`
- `reply_suggestions`
- `sentence_card`（条件触发）
- `memory_queued`（可选）
- `error`（异常时）

示例：

```text
data: {"type":"meta","user_turn":{"id":"...","turn_no":11,"candidate_id":"..."},"assistant_turn":{"id":"...","turn_no":12,"candidate_id":"..."}}

data: {"type":"transform_done","original_content":"I think 我们可以明天见","transformed_content":"I think we can meet tomorrow.","applied":true}

data: {"type":"chunk","content":"That sounds"}

data: {"type":"done","full_content":"That sounds great!","assistant_turn_id":"...","assistant_candidate_id":"..."}

data: {"type":"reply_suggestions","suggestions":[{"type":"relationship","en":"...","zh":"..."},{"type":"topic","en":"...","zh":"..."},{"type":"interaction","en":"...","zh":"..."}]}

data: {"type":"sentence_card","message_id":"...","sentence_card":{"surface":"That sounds great!","zh":"那听起来很棒！","key_phrases":[{"surface":"sounds great","ipa_us":"/saʊndz ɡreɪt/","zh":"听起来很棒"}],"favorite":{"enabled":true,"is_favorited":false,"saved_item_id":null}}}

data: {"type":"memory_queued","status":"queued"}
```

### 6.2 `/v1/turns/{turn_id}/regen/stream` 与 `/edit/stream`

- `meta`
- `chunk`（可多次）
- `done`
- `reply_suggestions`
- `sentence_card`（条件触发）
- `error`（异常时）

## 7. 学习卡与收藏字段合同

- `sentence_card` 不包含整句 `ipa_us` 字段。
- `sentence_card.favorite` 由服务端注入，不来自 LLM。
- 首次生成默认值固定：

```json
{
  "enabled": true,
  "is_favorited": false,
  "saved_item_id": null
}
```

- `GET /v1/chats/{chat_id}/turns` 返回 `candidate.extra` 时会移除 `sentence_card.ipa_us`（如果历史数据里残留该字段）。

## 8. 常见错误码（补充版）

| code | status | 说明 |
|---|---|---|
| `validation_failed` | 422 | 请求参数校验失败 |
| `auth_token_invalid` | 401 | token 缺失/无效 |
| `auth_send_code_failed` | 500 | 发送验证码失败 |
| `auth_code_invalid_or_expired` | 400 | 验证码错误或过期 |
| `user_profile_update_empty` | 400 | 用户资料更新为空 |
| `user_settings_update_empty` | 400 | 用户设置更新为空 |
| `character_not_found` | 404 | 角色不存在 |
| `character_private_forbidden` | 403 | 私有角色访问被拒绝 |
| `character_modify_forbidden` | 403 | 非创建者修改角色 |
| `character_delete_forbidden` | 403 | 非创建者删除角色 |
| `chat_not_found` | 404 | chat 不存在 |
| `chat_forbidden` | 403 | 非 chat 所属用户访问 |
| `chat_state_conflict` | 409 | chat 状态冲突（非 ACTIVE 等） |
| `turn_not_found` | 404 | turn 不存在 |
| `turn_state_conflict` | 409 | turn 状态冲突 |
| `turn_author_conflict` | 409 | turn 作者类型冲突 |
| `candidate_not_found` | 404 | candidate 不存在 |
| `turn_candidate_limit_reached` | 409 | 候选数达到上限 |
| `greeting_turn_locked` | 409 | greeting turn 不允许该操作 |
| `saved_item_duplicate` | 409 | 收藏重复 |
| `saved_item_filter_invalid` | 400 | 收藏筛选参数非法 |
| `saved_item_cursor_invalid` | 400 | 收藏游标非法 |
| `saved_item_id_invalid` | 400 | 收藏 ID 非法 |
| `saved_item_not_found` | 404 | 收藏不存在 |
| `upload_file_too_large` | 413 | 上传文件过大 |
| `upload_file_type_not_allowed` | 415 | 上传文件类型不支持 |
| `llm_service_error` | 502 | LLM 上游失败 |
| `chat_stream_failed` | 500 | 主 chat 流式失败 |
| `regen_stream_failed` | 500 | regen 流式失败 |
| `user_edit_stream_failed` | 500 | user edit 流式失败 |
| `memory_not_found` | 404 | 记忆不存在 |
| `memory_manage_failed` | 500 | 记忆管理失败 |
| `memory_search_failed` | 500 | 记忆检索失败 |
| `memory_delete_failed` | 500 | 记忆删除失败 |
| `memory_reset_failed` | 500 | 记忆重置失败 |
| `memory_consolidate_failed` | 500 | 记忆归并失败 |
| `db_connection_error` | 503 | DB/Milvus 不可用 |
| `external_error` | 502 | 通用上游依赖错误 |
| `external_timeout` | 504 | 上游依赖超时 |
| `internal_error` | 500 | 未知内部错误 |

文档更新时间：2026-02-25

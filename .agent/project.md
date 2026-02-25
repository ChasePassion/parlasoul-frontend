# NeuraChar（前后端一体）项目总结（当前实现）

## 0. 范围与目标

本文档描述当前代码已落地的真实系统，不包含未开发规划。

项目由两个仓库组成：

1. 后端：`E:\code\NeuraChar`（FastAPI + PostgreSQL + Milvus + LLM）
2. 前端：`E:\code\role-playing`（Next.js App Router）

系统主链路：

`Browser -> Next.js -> /v1,/uploads rewrite -> FastAPI -> PostgreSQL/Milvus/LLM/SMTP/LocalStorage`

## 1. 代码结构总览

### 1.1 后端关键目录

```text
NeuraChar/
├─ src/
│  ├─ main.py
│  ├─ bootstrap/
│  │  └─ app_factory.py
│  ├─ api/
│  │  ├─ deps.py
│  │  ├─ exceptions.py
│  │  ├─ response.py
│  │  ├─ schemas.py
│  │  └─ routers/
│  │     ├─ auth.py
│  │     ├─ users.py
│  │     ├─ characters.py
│  │     ├─ upload.py
│  │     ├─ memories.py
│  │     ├─ chats.py
│  │     ├─ turns.py
│  │     └─ saved_items.py
│  ├─ core/
│  │  ├─ config.py
│  │  ├─ dependencies.py
│  │  └─ uow.py
│  ├─ db/
│  │  ├─ models.py
│  │  └─ session.py
│  ├─ repositories/
│  ├─ services/
│  │  ├─ chat_service.py
│  │  ├─ turn_service.py
│  │  ├─ chat_learning_service.py
│  │  ├─ saved_item_service.py
│  │  ├─ user_settings_service.py
│  │  └─ ...
│  ├─ jobs/
│  │  └─ semantic_scheduler.py
│  └─ memory_system/
├─ docs/
│  ├─ api/
│  └─ migrations/
└─ tests/
```

### 1.2 前端关键目录

```text
role-playing/
├─ src/
│  ├─ app/
│  │  ├─ login/
│  │  ├─ setup/
│  │  └─ (app)/
│  │     ├─ page.tsx
│  │     ├─ chat/[id]/page.tsx
│  │     └─ profile/
│  ├─ components/
│  ├─ hooks/
│  └─ lib/
└─ next.config.ts
```

## 2. 后端架构分层

## 2.1 启动与装配

- 主入口：`src/main.py`
- App 工厂：`src/bootstrap/app_factory.py`
- 关键启动动作：
  - DB 连通性检查
  - Langfuse 初始化（可选）
  - 路由注册（auth/users/upload/memories/characters/chats/turns/saved-items）
  - `/uploads` 静态挂载
  - 语义归并定时任务（可开关）

## 2.2 API 入口层（Routers）

| Router | 路径前缀 | 职责 |
|---|---|---|
| `auth.py` | `/v1/auth` | 验证码登录与当前用户读取 |
| `users.py` | `/v1/users` | 资料、设置、创作者角色列表 |
| `characters.py` | `/v1/characters` | 角色 CRUD 与 market |
| `upload.py` | `/v1/upload` | 图片上传 |
| `memories.py` | `/v1/memories` | 记忆管理/检索/重置/归并 |
| `chats.py` | `/v1/chats` | chat 创建、分页、主流式对话 |
| `turns.py` | `/v1/turns` | 候选切换、regen、edit |
| `saved_items.py` | `/v1/saved-items` | 收藏创建/列表/删除 |

## 2.3 服务层（业务编排）

| Service | 主要职责 |
|---|---|
| `ChatService` | chat 主流式编排、turn/candidate 持久化、SSE 推送 |
| `TurnService` | select/regen/edit 分支控制与流式生成 |
| `ChatLearningService` | 混输转写、回复建议、知识卡生成 |
| `SavedItemService` | 收藏去重、分页、删除、卡片清洗 |
| `UserSettingsService` | 用户设置读取与更新 |
| `MemoryService` | memory manage/search/delete/reset/consolidate |

## 2.4 数据访问层

- Repository：按实体拆分（user/chat/turn/candidate/saved_item/...）
- `UnitOfWork`：事务边界统一管理
- 鉴权后通过 `set_config('app.current_user_id', ...)` 注入 DB 上下文，配合 RLS

## 2.5 基础设施层

- PostgreSQL（结构化数据）
- Milvus（向量记忆）
- LLM（对话、建议、卡片、记忆处理）
- SMTP（验证码）
- 本地存储（上传文件）
- Langfuse（可选可观测）

## 3. 前端集成边界

- `next.config.ts` 将 `/v1/*`、`/uploads/*` 重写到后端
- 前端只依赖 HTTP/SSE 协议，不内嵌后端业务规则
- 主要页面流：
  - `/login`（验证码）
  - `/setup`（资料补全）
  - `/`（发现页）
  - `/chat/[id]`（聊天主流程）
  - `/profile`（个人资料）

## 4. 关键业务流程

## 4.1 认证流程

1. `POST /v1/auth/send_code`
2. `POST /v1/auth/login`
3. 前端保存 token
4. `GET /v1/auth/me` / `GET /v1/users/me`

## 4.2 发现到进聊

1. 获取角色市场（`GET /v1/characters/market`）
2. 创建 chat（`POST /v1/chats`）或复用最近 chat（`GET /v1/chats/recent`）
3. 进入 `/chat/[id]`

## 4.3 主聊天流（`POST /v1/chats/{chat_id}/stream`）

服务端固定编排：

1. 下发 `meta`（服务端 turn/candidate ID）
2. 若用户混输且开关开启：执行转写并下发 `transform_done`
3. 流式生成 assistant：多次 `chunk`
4. 结束时下发 `done`
5. 生成三条回复建议并下发 `reply_suggestions`
6. 条件生成知识卡并下发 `sentence_card`
7. 记忆任务异步入队并下发 `memory_queued`（可选）

学习卡关键约束：

- 句级 `ipa_us` 已移除
- `favorite` 由服务端注入默认值，不由模型决定

## 4.4 Turn 分支流程

### 4.4.1 候选切换

- `POST /v1/turns/{turn_id}/select`
- `POST /v1/turns/{turn_id}/select/snapshot`

更新 `primary_candidate_id` 与 `active_leaf_turn_id`，可返回新快照供前端原子切换。

### 4.4.2 Regen

- `POST /v1/turns/{turn_id}/regen/stream`

事件顺序：`meta -> chunk* -> done -> reply_suggestions -> sentence_card? -> error?`

### 4.4.3 Edit

- `POST /v1/turns/{turn_id}/edit/stream`

创建新 user candidate + 新 assistant placeholder 后流式续写；事件顺序同 regen。

## 4.5 收藏流程

1. 前端在知识卡点击收藏
2. `POST /v1/saved-items`
3. 后端按 `(user_id, kind, source_message_id)` 去重
4. `GET /v1/saved-items` 供收藏夹分页展示
5. `DELETE /v1/saved-items/{saved_item_id}` 取消收藏

## 4.6 记忆流程

- 在线流程：`safe_memory_search` 检索相关记忆增强对话
- 回写流程：聊天完成后异步 `memory.manage`
- 运维流程：`/v1/memories/*` 提供手动管理
- 定时流程：`semantic_scheduler` 按配置执行语义归并

## 5. 配置与开关

集中在 `src/core/config.py`：

- 用户设置默认值（`display_mode`、`knowledge_card_enabled`、`mixed_input_auto_translate_enabled`、字号区间）
- LLM 与 Milvus 连接参数
- 语义归并任务开关与执行时间
- CORS、上传限制
- Langfuse 可选配置

## 6. 数据与安全要点

- RLS 作用于 `characters/chats/turns/candidates/user_settings/saved_items`
- 请求侧身份与数据 owner 强绑定，避免跨用户读写
- `saved_items.card` 在服务层会做字段清洗，去掉不需要的句级 IPA

## 7. 当前边界与注意事项

- 系统仍是双存储最终一致，不保证 PostgreSQL 与 Milvus 原子事务
- SSE 中建议/知识卡为“后置事件”，只在 assistant `done` 后发送
- 回放接口 `GET /v1/chats/{chat_id}/turns` 可通过 `include_learning_data` 控制学习字段透出

文档更新时间：2026-02-25

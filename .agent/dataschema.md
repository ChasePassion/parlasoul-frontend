# NeuraChar Data Schema（PostgreSQL + Milvus）

本文档基于当前代码与 migration 现状整理，覆盖两套持久化：

- PostgreSQL（结构化业务数据）
- Milvus（向量记忆数据）

当前“schema 真相”来源：

- `src/db/models.py`
- `docs/migrations/*.sql`
- `src/api/schemas.py`
- `src/schemas/*.py`
- `src/memory_system/*`

## 1. 总览

项目采用双存储架构：

- PostgreSQL：用户、角色、chat turn 树、候选、设置、收藏。
- Milvus：episodic / semantic 记忆及 narrative grouping。

关键边界：

- PostgreSQL 与 Milvus 没有分布式事务，属于最终一致。
- Postgres 主键以 UUID 为主，Milvus 主记忆主键为自增 `INT64`。
- Milvus 中 `user_id/character_id/chat_id` 用字符串存储（通常写 UUID 文本）。

## 2. PostgreSQL Schema

## 2.1 连接与会话

- 数据源：`settings.DATABASE_URL`
- Engine：`create_async_engine(..., pool_pre_ping=True)`
- Session：`async_sessionmaker(expire_on_commit=False, autoflush=False)`

请求鉴权成功后，会执行：

- `set_config('app.current_user_id', '<uuid>', true)`

用于 RLS 作用域隔离。

## 2.2 Enum Types

代码使用 `PG_ENUM(..., create_type=False)`，要求 DB 里已存在：

| Enum Type Name | Values | 用途 |
|---|---|---|
| `visibility_t` | `PUBLIC`,`PRIVATE`,`UNLISTED` | `characters.visibility` |
| `chat_visibility_t` | `PUBLIC`,`PRIVATE`,`UNLISTED` | `chats.visibility` |
| `chat_type_t` | `ONE_ON_ONE`,`ROOM` | `chats.type` |
| `chat_state_t` | `ACTIVE`,`ARCHIVED` | `chats.state` |
| `author_type_t` | `USER`,`CHARACTER`,`SYSTEM` | `turns.author_type` |
| `turn_state_t` | `OK`,`FILTERED`,`DELETED`,`ERROR` | `turns.state` |

## 2.3 业务表

### 2.3.1 `users`

| Column | Type | Null | Default | Note |
|---|---|---|---|---|
| `id` | UUID | No | `uuid4()` | PK |
| `email` | VARCHAR(255) | No | - | Unique |
| `username` | VARCHAR(50) | Yes | - | Unique |
| `avatar_url` | TEXT | Yes | - | - |
| `created_at` | TIMESTAMPTZ | No | `now()` | - |
| `updated_at` | TIMESTAMPTZ | No | `now()` + onupdate | - |
| `last_login_at` | TIMESTAMPTZ | Yes | - | - |

### 2.3.2 `email_login_codes`

| Column | Type | Null | Default | Note |
|---|---|---|---|---|
| `id` | INTEGER | No | autoincrement | PK |
| `email` | VARCHAR(255) | No | - | 非唯一 |
| `code_hash` | TEXT | No | - | SHA256 hash |
| `created_at` | TIMESTAMPTZ | No | `now()` | - |
| `expires_at` | TIMESTAMPTZ | No | - | 业务默认 5 分钟 |
| `used_at` | TIMESTAMPTZ | Yes | - | `NULL` 表示未使用 |

### 2.3.3 `user_settings`

| Column | Type | Null | Default | Note |
|---|---|---|---|---|
| `user_id` | UUID | No | - | PK, FK -> `users.id` (`ON DELETE CASCADE`) |
| `message_font_size` | SMALLINT | No | `16` | check: `14~24` |
| `display_mode` | VARCHAR(20) | No | `concise` | check: `concise|detailed` |
| `knowledge_card_enabled` | BOOLEAN | No | `true` | 学习卡开关 |
| `mixed_input_auto_translate_enabled` | BOOLEAN | No | `true` | 混输转写开关 |
| `created_at` | TIMESTAMPTZ | No | `now()` | - |
| `updated_at` | TIMESTAMPTZ | No | `now()` + onupdate | - |

约束：

- `user_settings_message_font_size_check`
- `user_settings_display_mode_check`

### 2.3.4 `characters`

| Column | Type | Null | Default | Note |
|---|---|---|---|---|
| `id` | UUID | No | `uuid4()` | PK |
| `identifier` | TEXT | Yes | - | 调试/展示 |
| `name` | VARCHAR(100) | No | - | - |
| `description` | TEXT | No | - | - |
| `system_prompt` | TEXT | No | - | - |
| `greeting_message` | TEXT | Yes | - | - |
| `avatar_file_name` | VARCHAR(255) | Yes | - | - |
| `visibility` | `visibility_t` | No | `PRIVATE` | enum |
| `tags` | TEXT[] | Yes | - | - |
| `interaction_count` | BIGINT | No | `0` | - |
| `creator_id` | UUID | Yes | - | FK -> `users.id` (`ON DELETE SET NULL`) |
| `created_at` | TIMESTAMPTZ | No | `now()` | - |
| `updated_at` | TIMESTAMPTZ | No | `now()` + onupdate | - |

### 2.3.5 `chats`

| Column | Type | Null | Default | Note |
|---|---|---|---|---|
| `id` | UUID | No | `uuid4()` | PK |
| `user_id` | UUID | No | - | FK -> `users.id` (`ON DELETE CASCADE`) |
| `character_id` | UUID | No | - | FK -> `characters.id` (`ON DELETE CASCADE`) |
| `type` | `chat_type_t` | No | `ONE_ON_ONE` | enum |
| `state` | `chat_state_t` | No | `ACTIVE` | enum |
| `visibility` | `chat_visibility_t` | No | `PRIVATE` | enum |
| `last_turn_at` | TIMESTAMPTZ | Yes | - | - |
| `last_turn_id` | UUID | Yes | - | 当前未声明 FK |
| `last_turn_no` | BIGINT | Yes | - | turn_no 游标 |
| `active_leaf_turn_id` | UUID | Yes | - | 当前激活分支叶子 |
| `last_read_turn_no` | BIGINT | Yes | - | - |
| `created_at` | TIMESTAMPTZ | No | `now()` | - |
| `updated_at` | TIMESTAMPTZ | No | `now()` + onupdate | - |
| `archived_at` | TIMESTAMPTZ | Yes | - | - |
| `meta` | JSONB | Yes | - | 扩展字段 |

### 2.3.6 `turns`

| Column | Type | Null | Default | Note |
|---|---|---|---|---|
| `id` | UUID | No | `uuid4()` | PK |
| `chat_id` | UUID | No | - | FK -> `chats.id` (`ON DELETE CASCADE`) |
| `turn_no` | BIGINT | No | - | chat 内递增 |
| `parent_turn_id` | UUID | Yes | - | 树结构父 turn |
| `parent_candidate_id` | UUID | Yes | - | 父 turn 的 candidate |
| `author_type` | `author_type_t` | No | - | `USER|CHARACTER|SYSTEM` |
| `author_user_id` | UUID | Yes | - | FK -> `users.id` |
| `author_character_id` | UUID | Yes | - | FK -> `characters.id` |
| `state` | `turn_state_t` | No | `OK` | enum |
| `is_proactive` | BOOLEAN | No | `false` | - |
| `primary_candidate_id` | UUID | Yes | - | 当前主候选 |
| `created_at` | TIMESTAMPTZ | No | `now()` | - |
| `updated_at` | TIMESTAMPTZ | No | `now()` + onupdate | - |
| `meta` | JSONB | Yes | - | 扩展字段 |

关键约束/索引：

- `UNIQUE (chat_id, turn_no)`
- `INDEX (chat_id, parent_turn_id)`

### 2.3.7 `candidates`

| Column | Type | Null | Default | Note |
|---|---|---|---|---|
| `id` | UUID | No | `uuid4()` | PK |
| `turn_id` | UUID | No | - | FK -> `turns.id` (`ON DELETE CASCADE`) |
| `candidate_no` | BIGINT | No | - | turn 内序号 |
| `content` | TEXT | No | - | - |
| `model_type` | VARCHAR(80) | Yes | - | 生成模型标识 |
| `is_final` | BOOLEAN | No | `true` | - |
| `rank` | BIGINT | Yes | - | - |
| `created_at` | TIMESTAMPTZ | No | `now()` | - |
| `updated_at` | TIMESTAMPTZ | No | `now()` + onupdate | - |
| `extra` | JSONB | Yes | - | 学习数据/扩展字段 |

关键约束：

- `UNIQUE (turn_id, candidate_no)`

`extra` 当前常见结构：

```json
{
  "input_transform": {
    "applied": true,
    "transformed_content": "I think we can meet tomorrow."
  },
  "sentence_card": {
    "surface": "That sounds great!",
    "zh": "那听起来很棒！",
    "key_phrases": [
      {"surface":"sounds great","ipa_us":"/saʊndz ɡreɪt/","zh":"听起来很棒"}
    ],
    "favorite": {
      "enabled": true,
      "is_favorited": false,
      "saved_item_id": null
    }
  }
}
```

说明：

- 句级 `sentence_card.ipa_us` 已移除（`2026-02-26_remove_sentence_card_sentence_ipa.sql`）
- `favorite` 由服务端注入，不由 LLM 生成

### 2.3.8 `saved_items`

| Column | Type | Null | Default | Note |
|---|---|---|---|---|
| `id` | UUID | No | `uuid4()` | PK |
| `user_id` | UUID | No | - | FK -> `users.id` (`ON DELETE CASCADE`) |
| `kind` | VARCHAR(50) | No | - | 例如 `sentence_card` |
| `display_surface` | TEXT | No | - | 展示原文 |
| `display_zh` | TEXT | No | - | 展示中文 |
| `card` | JSONB | No | - | 收藏时的卡片快照 |
| `source_role_id` | UUID | No | - | 来源角色 |
| `source_chat_id` | UUID | No | - | 来源 chat |
| `source_message_id` | VARCHAR(255) | No | - | 来源消息/候选 ID |
| `source_turn_id` | UUID | Yes | - | 来源 turn |
| `source_candidate_id` | UUID | Yes | - | 来源 candidate |
| `source_meta` | JSONB | Yes | - | 额外来源信息 |
| `created_at` | TIMESTAMPTZ | No | `now()` | - |

关键约束/索引：

- `UNIQUE (user_id, kind, source_message_id)`
- `INDEX (user_id, created_at DESC)`
- `INDEX (user_id, kind)`
- `INDEX (user_id, source_chat_id)`

card 清洗规则（服务层）：

- 去除 `card.ipa_us`
- 若存在嵌套 `card.sentence_card.ipa_us` 也会去除

## 2.4 逻辑关系图

```text
users
  ├─< characters (creator_id)
  ├─< chats (user_id)
  ├─1 user_settings (user_id PK)
  └─< saved_items (user_id)

characters
  └─< chats (character_id)

chats
  └─< turns (chat_id)

turns
  └─< candidates (turn_id)
```

## 2.5 RLS 与隔离策略

已落地 migration：

- `2026-02-18_row_level_security.sql`：`characters/chats/turns/candidates`
- `2026-02-19_user_settings.sql`：`user_settings`
- `2026-02-24_phase1_learning.sql`：`saved_items`

核心原则：

- 通过 `app.current_user_id` 限定“当前用户可见/可改数据”。
- `saved_items` 和 `user_settings` 均启用并强制 RLS。

## 2.6 Migration 现状

当前仓库有可回放 SQL migration：

- `2026-02-16_turn_tree.sql`
- `2026-02-18_row_level_security.sql`
- `2026-02-19_user_settings.sql`
- `2026-02-24_phase1_learning.sql`
- `2026-02-26_remove_sentence_card_sentence_ipa.sql`

## 3. Milvus Vector Schema

## 3.1 配置

来自 `MemoryConfig`：

- `milvus_uri`: `MILVUS_URL`
- `collection_name`: 默认 `memories`
- `embedding_dim`: `2560`

## 3.2 集合：`memories`

| Field | DataType | Meaning |
|---|---|---|
| `id` | `INT64` | PK, auto_id |
| `user_id` | `VARCHAR(128)` | 用户标识（UUID 字符串） |
| `character_id` | `VARCHAR(128)` | 角色标识（UUID 字符串） |
| `memory_type` | `VARCHAR(32)` | 通常 `episodic` / `semantic` |
| `ts` | `INT64` | 秒级时间戳 |
| `chat_id` | `VARCHAR(128)` | chat 标识 |
| `text` | `VARCHAR(65535)` | 记忆文本 |
| `vector` | `FLOAT_VECTOR(2560)` | 向量 |
| `group_id` | `INT64` | narrative group，默认 `-1` |

索引：

- field: `vector`
- index_type: `AUTOINDEX`
- metric_type: `COSINE`

## 3.3 集合：`groups`

| Field | DataType | Meaning |
|---|---|---|
| `group_id` | `INT64` | PK, auto_id |
| `user_id` | `VARCHAR(128)` | 用户标识 |
| `character_id` | `VARCHAR(128)` | 角色标识 |
| `centroid_vector` | `FLOAT_VECTOR(2560)` | 组中心向量 |
| `size` | `INT64` | 组内成员数 |

索引：

- field: `centroid_vector`
- index_type: `AUTOINDEX`
- metric_type: `IP`

## 3.4 查询过滤

常见 filter：

- `user_id == "..." and character_id == "..."`
- `memory_type == "episodic"`
- `memory_type == "semantic"`
- `group_id == <int>`
- `id in [1,2,3]`

## 4. API Payload 结构补充（Memory）

来自 `src/api/schemas.py`：

- `ManageRequest`: `character_id, chat_id, user_text, assistant_text`
- `SearchRequest`: `character_id, query`
- `ResetRequest`: `character_id`
- `ConsolidateRequest`: `character_id`
- `SearchResponse`: `episodic[] + semantic[]`

注意：这些 endpoint 中 `user_id` 不由请求体传递，而由鉴权用户隐式决定。

## 5. 一致性与风险提示

- 目前为双存储最终一致，不保证跨 PostgreSQL/Milvus 原子提交。
- 若 RLS 上下文未正确注入（`app.current_user_id`），会导致查询/写入行为异常。
- `saved_items.card` 是快照，不随原始 candidate.extra 自动回写。

文档更新时间：2026-02-25

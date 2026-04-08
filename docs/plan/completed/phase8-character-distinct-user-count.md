# Phase 8 · 角色卡片独立用户数真实化

状态：`active`

## 1. 当前现状

前端 `CharacterCard.tsx:80-83` 右上角显示硬编码 `5.6k`，表示与该角色聊天的用户数（mock）。

需求：替换为真实数据 —— 自角色创建以来，有多少个独立用户曾向该角色发送过消息。

**关键概念区分**：
- `interaction_count`：AI 回复次数，每次 character 发送消息时 +1
- `distinct_user_count`（本次目标）：独立用户数，有多少不同用户曾向该角色发过消息

两者是完全不同的指标。

## 2. 目标

在 `CharacterResponse` 中新增 `distinct_user_count` 字段，后端实时 SQL 计算（count distinct），前端直接使用。

## 3. 后端改动

### 3.1 Schema 层

**`src/schemas/character.py`**：`CharacterResponse` 新增字段

```python
distinct_user_count: int = 0
```

### 3.2 Repository 层

**`src/repositories/character_repository.py`**：新增两个方法

```python
async def count_distinct_users_by_character(
    self,
    character_id: uuid.UUID,
) -> int:
    """统计曾向该角色发送过消息的独立用户数。"""
    # SQL: SELECT COUNT(DISTINCT chats.user_id)
    #      FROM turns
    #      JOIN chats ON turns.chat_id = chats.id
    #      WHERE chats.character_id = :cid
    #        AND turns.author_type = 'USER'

async def batch_count_distinct_users(
    self,
    character_ids: list[uuid.UUID],
) -> dict[uuid.UUID, int]:
    """批量查询，避免 N+1。"""
    # 一次 SQL，带 GROUP BY character_id
```

### 3.3 Service 层

**`src/services/character_service.py`**

- `_to_response` 函数新增 `distinct_user_count: int = 0` 参数
- `list_market_characters`：批量查出计数，注入每个响应
- `list_my_characters`：同上
- `get_character`：单条查询
- `create_character`：保持 `0`（新建角色自然为 0）

## 4. 前端改动

### 4.1 类型层

- **`src/lib/api-service.ts`**：`CharacterResponse` 接口新增 `distinct_user_count: number`
- **`src/components/Sidebar.tsx`**：`Character` 接口新增 `distinct_user_count?: number`

### 4.2 数据映射层

- **`src/app/(app)/page.tsx`**：`mappedCharacters` 补充 `distinct_user_count: character.distinct_user_count`

### 4.3 展示层

- **`src/components/CharacterCard.tsx`**：将硬编码 `5.6k` 替换为真实数据，保留千分位格式化

## 5. API 契约

| 端点 | 行为 |
|------|------|
| `GET /v1/characters/market` | 每条返回 `distinct_user_count` |
| `GET /v1/characters` | 每条返回 `distinct_user_count` |
| `GET /v1/characters/{id}` | 单条返回 `distinct_user_count` |
| `POST /v1/characters` | 新建角色返回 `distinct_user_count = 0` |

## 6. 性能

- 列表页（≤100条）：1次批量 SQL
- 单条详情：1次 SQL count distinct
- 已有索引支撑，无需额外建索引

## 7. Non-goals

- 不修改 `interaction_count` 语义
- 不引入后台定时任务或计数器表
- 不改动数据库结构（不改 `characters` 表，不建新表）

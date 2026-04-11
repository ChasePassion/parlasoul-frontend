# 前端日志系统

## 架构

```
┌─────────────────────────────────────────┐
│           调用方 (Component / Hook)       │
│  logger.info(...) / logger.fromError()   │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│           src/lib/logger/index.ts       │
│  emit() → transports.forEach(t => t())   │
│                                         │
│  transports[] = [                        │
│    consoleTransport,  ← 始终执行         │
│    fetchTransport,    ← ERROR / dev      │
│  ]                                       │
└─────────────────┬───────────────────────┘
                  │  HTTP POST
                  ▼
┌─────────────────────────────────────────┐
│         src/app/api/logs/route.ts       │
│  POST /api/logs → logs/{module}.log     │
└─────────────────────────────────────────┘
```

* **控制台输出**：始终输出（所有级别），由 `consoleTransport` 处理
* **文件持久化**：`ERROR` 始终写入；开发模式下所有级别都写入，由 `fetchTransport` 处理
* **传输层可扩展**：新增 transport 只需在 `transports[]` 数组中注册，无需改动 `emit`

---

## 文件结构

```
src/lib/logger/
├── index.ts      # 门面层：emit(), transports[], logger.info/warn/error/fromError()
├── format.ts     # LogEntry, SUMMARY_FIELDS, formatEntry(), formatHumanReadable()
└── events.ts     # Module / CharacterEvent 常量

src/app/api/logs/
└── route.ts      # POST 处理器：写入 logs/{module}.log

logs/             # 被 Git 忽略，首次写入时创建
├── character.log # 前端 character 模块日志
└── ...
```

---

## LogEntry 结构

```typescript
interface LogEntry {
  ts: string;      // "2026-04-11 14:30:00"  （精确到秒）
  level: "INFO" | "WARN" | "ERROR";
  module: string;  // 文件名前缀，例如 "character"
  event: string;   // 点命名空间事件，例如 "character.started"
  message: string; // 人类可读的摘要信息
  [key: string]: unknown; // 额外字段
}
```

---

## 控制台输出格式（人类可读）

```
[<ts>] [<level>] [<module>] <message> [<field>=<value>]...
```

示例：

```
[2026-04-11 14:30:00] [INFO] [character] Character create started [event=character.started] [mode=create] [name=Alice]
```

---

## 文件输出格式（结构化）

文件输出包含两部分：

1. **必填字段**（始终存在）：`ts`、`level`、`module`、`event`、`message`
2. **摘要字段**（仅在存在时写入）：如下所列

```
ts=<ts> level=<level> module=<module> event=<event> message="<message>" [<summary_field>=<value>...] [extra_field=value...]
```

示例：

```
ts=2026-04-11 14:30:00 level=INFO module=character event=character.started message="Character create started" mode=create name=Alice
```

### 摘要字段（只要在 entry 中存在就一定写入）

`event`, `character_id`, `error_status`, `error_code`, `elapsed_ms`, `user_id`, `mode`

> 注意：`error_detail` 会由 `fromError` 在 API 错误场景下输出，但它**不在** `SUMMARY_FIELDS` 中。
> `error_type` 会用于原生 JS 错误，也**不在** `SUMMARY_FIELDS` 中。
> 这些额外字段不放进 `SUMMARY_FIELDS`，是因为它们只适用于特定错误类型，
> 并不属于共享的结构化字段契约的一部分。

---

## 传输层

`index.ts` 中维护一个 `transports[]` 数组，`emit` 调用时遍历执行：

```typescript
const transports: Array<(entry: LogEntry) => void> = [
  consoleTransport,  // 始终执行：console.log/warn/error + 完整 entry 对象
  fetchTransport,    // 仅 ERROR 或开发模式：fetch POST /api/logs
];

function emit(...) {
  const entry = formatEntry(level, module, event, message, extra);
  transports.forEach((t) => t(entry));
}
```

**新增传输层**：在 `transports[]` 数组中追加即可，无需修改 `emit` 或 `logger` 对象。

---

## API 路由

**`POST /api/logs`**

接收 JSON 格式的 `LogEntry`，并向 `logs/{module}.log` 写入一行。

* 成功时返回 `{ success: true }`
* 文件写入失败时返回 `{ error: "..." }`，状态码为 500
* JSON 格式错误时返回 500
* `fetchTransport` 内部静默忽略网络错误，不会阻塞调用方

---

## 持久化策略

| 级别    | 开发环境     | 生产环境     |
| ----- | -------- | -------- |
| ERROR | 控制台 + 文件 | 控制台 + 文件 |
| WARN  | 控制台 + 文件 | 仅控制台     |
| INFO  | 控制台 + 文件 | 仅控制台     |

---

## 用法

### 1. 导入 logger 和事件常量

```typescript
import { logger, Module, CharacterEvent } from "@/lib/logger";
```

### 2. 定义新的模块 / 事件常量

在 `src/lib/logger/events.ts` 中：

```typescript
export const Module = {
  CHARACTER: "character",
  // CHAT: "chat",
  // AUTH: "auth",
} as const;

export const CharacterEvent = {
  STARTED: "character.started",
  VOICE_RESOLVED: "character.voice_resolved",
  API_CALLED: "character.api_called",
  COMPLETED: "character.completed",
  FAILED: "character.failed",
} as const;
```

### 3. 在关键控制点记录日志

```typescript
// 入口点
logger.info(Module.CHARACTER, CharacterEvent.STARTED, "Character create started", {
  mode: "create",
  name: name.trim(),
});

// 完成非平凡解析之后
logger.info(Module.CHARACTER, CharacterEvent.VOICE_RESOLVED, "Voice profile resolved", {
  voice_provider: voiceProvider,
  voice_source_type: voiceSourceType,
});

// 外部调用之前
logger.info(Module.CHARACTER, CharacterEvent.API_CALLED, "Calling createCharacter API", {
  llm_provider: selectedLLMProvider,
  llm_model: selectedLLMModel,
});

// 成功时
logger.info(Module.CHARACTER, CharacterEvent.COMPLETED, "Character create completed", {
  character_id: savedCharacter.id,
  elapsed_ms: Date.now() - startTime,
});

// 失败时（自动识别 ApiError 并提取 status/code/detail）
logger.fromError(Module.CHARACTER, err, CharacterEvent.FAILED, {
  mode,
  elapsed_ms: Date.now() - startTime,
});
```

`logger.fromError` 导入 `@/lib/token-store` 中的 `ApiError` class，会区分：

* `ApiError` → 提取 `status`、`code`、`detail`，输出 `error_status`/`error_code`/`error_detail`
* `Error`（原生）→ 提取 `name`，输出 `error_type`
* 其他值 → 转为字符串

---

## 摘要字段：唯一事实来源

在 `src/lib/logger/format.ts` 中作为 `SUMMARY_FIELDS` 常量统一定义：

```typescript
export const SUMMARY_FIELDS = [
  "event",
  "character_id",
  "error_status",
  "error_code",
  "elapsed_ms",
  "user_id",
  "mode",
] as const;
```

`formatHumanReadable()`（控制台）、`consoleTransport` 和 API 路由都读取这个常量，因此没有重复定义。

---

## 添加日志指南

### 何时添加日志

| 场景 | 添加日志 | 理由 |
|------|---------|------|
| 异步操作开始（fetch / stream） | ✅ | 追踪发起时间，计算耗时 |
| 非平凡解析 / 决策完成 | ✅ | 记录输入输出，定位解析异常 |
| 外部 API 调用 | ✅ | 记录请求参数和响应状态 |
| 操作成功 / 失败 | ✅ | 记录结果和耗时 |
| 简单赋值 / 纯函数 | ❌ | 无调试价值 |
| 热循环 / 每条消息 | ❌ | 日志过多，无法定位 |

### 日志点类型（每个操作推荐 5 个）

```
STARTED  → 操作入口，唯一
RESOLVED → 非平凡解析完成（如 voice 解析、配置合并）
API_CALLED → 外部请求发出
COMPLETED → 成功结束，携带 elapsed_ms
FAILED   → 异常捕获，携带 elapsed_ms + fromError
```

### 新增一个模块

**Step 1 — 定义模块和事件常量**（`src/lib/logger/events.ts`）

```typescript
export const Module = {
  CHARACTER: "character",
  CHAT: "chat",        // ← 新增
  // ...
} as const;

export const ChatEvent = {           // ← 新增事件组
  SESSION_STARTED: "chat.session.started",
  MESSAGE_SENT: "chat.message.sent",
  COMPLETED: "chat.completed",
  FAILED: "chat.failed",
} as const;
```

**Step 2 — 在业务代码中导入使用**

```typescript
import { logger, Module, ChatEvent } from "@/lib/logger";

const handleSend = async (message: string) => {
  const startTime = Date.now();

  logger.info(Module.CHAT, ChatEvent.SESSION_STARTED, "Chat session started", {
    message_length: message.length,
  });

  try {
    const result = await sendMessage(message);

    logger.info(Module.CHAT, ChatEvent.COMPLETED, "Chat session completed", {
      elapsed_ms: Date.now() - startTime,
    });
  } catch (err) {
    logger.fromError(Module.CHAT, err, ChatEvent.FAILED, {
      elapsed_ms: Date.now() - startTime,
    });
  }
};
```

**Step 3 — 验证**

日志文件 `logs/chat.log` 会在首次写入时自动创建，无需手动配置。

### 事件命名规范

* 使用点号分隔：`{module}.{resource}.{action}`
* 动词用过去式（started / resolved / completed / failed），名词用一般现在时（sent / received）
* 复用已有事件常量，不要在调用处硬编码字符串

### 字段命名规范

* 布尔值：`is_xxx` / `has_xxx`
* ID 类：`xxx_id`（如 `character_id`、`message_id`）
* 耗时：`elapsed_ms`（毫秒整数）
* 状态码：`error_status`（HTTP 状态码）
* 错误码：`error_code`（业务错误码）
* 避免中文、特殊字符、空格

---

## 与后端日志的对比

| 维度   | 后端（Python）              | 前端（TypeScript）            |
| ---- | ----------------------- | ------------------------- |
| 时间戳  | `[2026-04-11 14:30:00]` | `ts=2026-04-11 14:30:00`  |
| 级别   | `[INFO]`                | `level=INFO`              |
| 模块   | `[character]`           | `module=character`        |
| 事件   | —                       | `event=character.started` |
| 消息   | 原始字符串                   | `message="..."`          |
| 额外字段 | `[field=value]`         | `field=value`（无方括号）       |
| 文件   | `logs/app.log`          | `logs/{module}.log`      |

二者共同点：都使用精确到秒的时间戳、结构化 `key=value` 字段，以及按模块拆分日志文件。

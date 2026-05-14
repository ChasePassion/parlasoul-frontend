# Phase 2.0 — 聊天图片视觉功能（详细实施方案）

## 当前现状

### 后端
- Chat 路由绑定 `deepseek`（`deepseek-v4-flash`），纯文本模型，不支持图片输入
- 学习路由绑定 `dashscope`（`qwen3.5-flash`），经测试支持 OpenAI 兼容格式的 `image_url` 输入
- `ChatStreamRequest`（`src/schemas/chat.py:126-134`）仅有 `content: str` 字段，`extra="forbid"`
- 消息格式全链路 `list[dict[str, str]]`，content 为纯文本字符串
- 候选内容存储在 `Candidate.content`（Text 字段），图片引用无存储位置
- 已有 R2 上传两阶段流程（presign → PUT → complete），支持 `user_avatar / character_avatar / voice_avatar`
- `CandidateResponse` 唯一构造点在 `src/services/chat_service.py:191-209` 的 `_candidate_response()` 函数
- LLM 调用链：`ChatService` → `CharacterLLMService` → `LLMGatewayRepository` → `LLMGatewayService` → `LLMClient`

### 前端
- `ChatInput`（`src/components/ChatInput.tsx`）已有 "+" 按钮占位（line 648），点击弹出 `toast("功能开发中")`
- 已有两个隐藏 `<input type="file" accept="image/*">`（line 541-558, 812-830），无 onChange
- 已有 shadcn `Dialog`、`Popover`、`Sheet` 组件
- `ChatMessage`（`src/components/ChatMessage.tsx`）用户消息为纯文本 `<p>` 标签（line 400），`w-[70%]` 最大宽度
- `Message` 接口（`src/components/ChatMessage.tsx:18-38`）无图片字段
- SSE 调用：`useChatSession`（line 1490-1492）→ `ApiService.streamChatMessage`（line 1539-1685），body 为 `{ content: string }`
- 已有图片上传流程 `uploadFile`（`api-service.ts:890-934`），`MediaUploadKind` 仅 avatar 类型（line 863）
- `mapTurnsPageMessage`（`useChatSession.ts:102-136`）映射后端 turn 数据到 `Message`
- `handleSendMessage`（`useChatSession.ts:1434-1826`）构造消息时只有 `content` 字段
- 响应式断点：`useIsMobile` = `max-width: 767px`

---

## 方案目标

用户可以在聊天中发送最多 5 张图片，模型使用 `qwen3.5-flash` 视觉能力理解图片并回复。图片持久存储于 R2，历史消息可查看。

---

## 核心设计决策

### 1. 模型路由：带图消息自动切换

- 纯文本消息 → 走当前默认路由（deepseek）
- 带图消息 → 走 `dashscope`（qwen3.5-flash）
- 在 `CharacterLLMRouteService` 新增 `resolve_vision_route()` 方法
- `ChatService.stream_chat_with_prep()` 中根据是否有图片决定调用哪个路由

### 2. 图片持久化与双版本存储

上传时生成两个版本：

| 版本 | R2 Key | 用途 | 格式 |
|---|---|---|---|
| **原图** | `chat_image/{user_id}/{image_id}/original.{ext}` | LLM 视觉调用、Lightbox 大图查看 | 保持上传格式（JPEG/PNG/WebP） |
| **展示图** | `chat_image/{user_id}/{image_id}/display.avif` | 聊天历史列表中显示 | AVIF，最大 1024px 长边 |

图片 URL 存储在 `Candidate.extra` JSONB 字段中：
```json
{
  "chat_images": [
    {"original": "https://r2.../original.jpg", "display": "https://r2.../display.avif"},
    ...
  ]
}
```

### 3. 图片传输给 LLM

- 后端用 `original` URL（原始格式，保证兼容性）构造 `image_url` content block 传给 Qwen
- 不使用 AVIF 传给 LLM，因为部分模型 API 可能不支持 AVIF 解码

### 4. 点击查看大图（Lightbox）

- 输入框预览区和消息气泡中的图片均可点击
- 点击后打开全屏 Lightbox，使用 shadcn `Dialog` 实现
- 支持左右切换多张图片、键盘方向键、点击空白关闭

---

## 实施路径

### Step 1 — 后端：`MediaUploadKind` + `ImageProcessingService` 扩展

#### 1a. `src/schemas/media.py` (53 行)

**Line 11-14** — 枚举新增成员：
```python
class MediaUploadKind(StrEnum):
    USER_AVATAR = "user_avatar"
    CHARACTER_AVATAR = "character_avatar"
    VOICE_AVATAR = "voice_avatar"
    CHAT_IMAGE = "chat_image"           # ← 新增
```

**Line 48-52** — `CompleteUploadResponse` 新增可选字段：
```python
class CompleteUploadResponse(SQLModel):
    upload_id: str
    image_key: str
    avatar_urls: AvatarUrls | None = None   # ← 改为可选，chat_image 无 avatar_urls
    content_type: str = "image/avif"
    original_url: str | None = None          # ← 新增，chat_image 专用
    display_url: str | None = None           # ← 新增，chat_image 专用
```

#### 1b. `src/services/media_url_service.py` (144 行)

**Line 10-14** — `_KIND_PATH_SEGMENT` dict 新增映射：
```python
_KIND_PATH_SEGMENT = {
    MediaUploadKind.USER_AVATAR: "users",
    MediaUploadKind.CHARACTER_AVATAR: "characters",
    MediaUploadKind.VOICE_AVATAR: "voices",
    MediaUploadKind.CHAT_IMAGE: "chat",          # ← 新增
}
```

新增 helper 函数（在文件末尾 `public_media_content_type` 之后）：
```python
def chat_image_display_object_key(image_key: str) -> str:
    return f"{image_key}/display.avif"
```

**Line 116-129** — `validate_public_media_object_key` 新增 chat_image 路径验证：
```python
def validate_public_media_object_key(object_key: str) -> str | None:
    ...
    if normalized.startswith("voices/preview/") and normalized.endswith(".mp3"):
        return normalized
    if normalized.startswith("images/chat/") and not normalized.endswith("/"):
        return normalized                      # ← 新增：允许 chat_image 路径
    return None
```

#### 1c. `src/services/image_processing_service.py` (187 行)

新增方法（在 `convert_to_avif` 之后，line ~63）：
```python
async def build_display_variant(self, original_bytes: bytes, max_dimension: int = 1024) -> ImageVariant:
    """生成单个展示用 AVIF 变体（长边不超过 max_dimension）。"""
    return await anyio.to_thread.run_sync(self._build_display_variant_sync, original_bytes, max_dimension)

def _build_display_variant_sync(self, original_bytes: bytes, max_dimension: int) -> ImageVariant:
    self.assert_avif_supported()
    with Image.open(io.BytesIO(original_bytes)) as source:
        source.load()
        normalized = ImageOps.exif_transpose(source)
        if normalized.mode not in ("RGB", "RGBA"):
            normalized = normalized.convert("RGBA")
        if normalized.mode == "RGBA":
            canvas = Image.new("RGB", normalized.size, (255, 255, 255))
            canvas.paste(normalized, mask=normalized.getchannel("A"))
            normalized = canvas
        else:
            normalized = normalized.convert("RGB")
        # 缩放
        w, h = normalized.size
        ratio = min(max_dimension / max(w, h), 1.0)
        if ratio < 1.0:
            new_size = (int(w * ratio), int(h * ratio))
            normalized = normalized.resize(new_size, Image.LANCZOS)
        output = io.BytesIO()
        normalized.save(output, format="AVIF", quality=self._settings.MEDIA_IMAGE_QUALITY)
        return ImageVariant(size=max(normalized.size), body=output.getvalue())
```

#### 1d. `src/services/upload_service.py` (320 行)

**`create_presigned_upload` 方法（line 59-124）**：无需修改，已通用。`avatar_image_key` 函数会根据新的 `_KIND_PATH_SEGMENT` 映射生成 `images/chat/{user_id}/{image_id}` 路径。

**`complete_upload` 方法（line 126-218）**：在 line 174-176（读取原始文件并生成变体）之前，根据 `kind` 分支处理：

```python
# 在 line 173 (original = await self._r2_storage.get_object(...)) 之后
kind = str(session.get("kind", ""))
if kind == "chat_image":
    # chat_image：生成单个 AVIF 展示图，不做头像变体
    display_variant = await self._image_processor.build_display_variant(original.body)
    display_key = chat_image_display_object_key(image_key)
    await self._r2_storage.put_object(
        object_key=display_key,
        body=display_variant.body,
        content_type="image/avif",
        cache_control=CACHE_CONTROL_IMMUTABLE,
    )
    original_url = build_r2_public_url(object_key) or build_media_url(object_key)
    display_url = build_r2_public_url(display_key) or build_media_url(display_key)
    await self._media_cache.mark_upload_completed(...)
    return CompleteUploadResponse(
        upload_id=request.upload_id,
        image_key=image_key,
        avatar_urls=None,
        original_url=original_url,
        display_url=display_url,
    )
# 原有头像变体逻辑继续...
```

需要在文件头 import 中新增：
```python
from src.services.media_url_service import chat_image_display_object_key, build_r2_public_url
```

---

### Step 2 — 后端：`ChatStreamRequest` 扩展

**文件：** `src/schemas/chat.py`

**Line 126-134** — 扩展请求模型：

```python
class ChatImageRef(SQLModel):
    """Single image reference with original and display URLs."""
    original: str
    display: str

class ChatStreamRequest(SQLModel):
    """Request model for streaming message generation."""
    model_config = ConfigDict(extra="forbid")

    content: str = Field(..., min_length=1, description="User message content")
    client_message_id: str | None = Field(
        default=None,
        description="Optional client idempotency key",
    )
    images: list[ChatImageRef] = Field(
        default_factory=list,
        max_length=5,
        description="Image attachments (max 5)",
    )
```

---

### Step 3 — 后端：`CandidateResponse` 扩展

**文件：** `src/schemas/chat.py`

**Line 52-62** — 新增字段：
```python
class CandidateResponse(SQLModel):
    """Primary candidate for a turn (Phase 1 only)."""

    id: str
    candidate_no: int
    content: str
    model_type: str | None = None
    is_final: bool = True
    rank: int | None = None
    created_at: datetime
    extra: CandidateExtra | None = None
    chat_images: list[ChatImageRef] | None = None    # ← 新增
```

---

### Step 4 — 后端：路由层传递图片

**文件：** `src/api/routers/chats.py`

**Line 125-152** — `stream_chat` 端点：

```python
@router.post("/{chat_id}/stream")
async def stream_chat(
    chat_id: uuid.UUID,
    req: ChatStreamRequest,
    current_user: User = Depends(deps.get_current_user),
    service: ChatService = Depends(get_chat_service),
) -> StreamingResponse:
    prep = await service.prepare_stream(
        current_user=current_user,
        chat_id=chat_id,
        content=req.content,
        images=req.images,                    # ← 新增
    )

    async def event_generator():
        async for item in service.stream_chat_with_prep(
            prep=prep,
            current_user=current_user,
            content=req.content,
            images=req.images,                # ← 新增
        ):
            yield item

    return StreamingResponse(event_generator(), media_type="text/event-stream", headers=SSE_HEADERS)
```

---

### Step 5 — 后端：`ChatService` 核心改造

**文件：** `src/services/chat_service.py`

#### 5a. `_StreamPrep` dataclass（line 321-336）

新增字段：
```python
@dataclass(frozen=True)
class _StreamPrep:
    ...  # 现有字段不变
    timing: dict[str, float] | None = None
    has_images: bool = False                      # ← 新增
```

#### 5b. `prepare_stream` 公共方法（line 370-380）

签名扩展：
```python
async def prepare_stream(
    self, current_user: User, chat_id: uuid.UUID, content: str,
    images: list[ChatImageRef] | None = None,     # ← 新增
) -> _StreamPrep:
    return await self._prepare_stream(
        current_user=current_user, chat_id=chat_id, content=content, images=images
    )
```

#### 5c. `_prepare_stream` 私有方法（line 1683-1861）

签名扩展：
```python
async def _prepare_stream(
    self, current_user: User, chat_id: uuid.UUID, content: str,
    images: list[ChatImageRef] | None = None,     # ← 新增
) -> _StreamPrep:
```

在构造用户 Candidate（line 1792-1797）时存储图片引用：
```python
# 原代码 line 1792-1797:
user_cand = Candidate(
    ...,
    content=content,
    ...
)

# 修改为：
cand_extra = None
if images:
    cand_extra = {"chat_images": [{"original": img.original, "display": img.display} for img in images]}

user_cand = Candidate(
    ...,
    content=content,
    extra=cand_extra,                              # ← 新增
    ...
)
```

返回值（line 1846-1861）新增 `has_images`：
```python
return _StreamPrep(
    ...,
    has_images=bool(images),                       # ← 新增
)
```

#### 5d. `stream_chat_with_prep` 方法（line 807-1628）

签名扩展：
```python
async def stream_chat_with_prep(
    self,
    prep: _StreamPrep,
    current_user: User,
    content: str,
    images: list[ChatImageRef] | None = None,     # ← 新增
) -> AsyncGenerator[str, None]:
```

**路由切换**（在 line ~835 附近，变量初始化区域）：
```python
# 路由切换：带图消息走 vision 路由
if images:
    resolved_route = self._route_service.resolve_vision_route()
else:
    resolved_route = prep.resolved_llm_route
```

后续代码中所有使用 `prep.resolved_llm_route` 的地方，改为使用 `resolved_route` 变量。

**构建多模态消息**（line 1236-1238）：
```python
# 原代码:
messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
messages.extend(history_messages)
messages.append({"role": "user", "content": outbound_user_content})

# 修改为:
from typing import Any
messages: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]
messages.extend(history_messages)
if images:
    user_content: list[dict[str, Any]] = [{"type": "text", "text": outbound_user_content}]
    for img in images:
        user_content.append({"type": "image_url", "image_url": {"url": img.original}})
    messages.append({"role": "user", "content": user_content})
else:
    messages.append({"role": "user", "content": outbound_user_content})
```

注意：`history_messages` 已经是 `list[dict[str, Any]]` 类型（从 `_load_llm_history_messages_from_leaf` 返回），直接 extend 即可。

#### 5e. `_load_llm_history_messages_from_leaf`（line 1863-1914）

返回类型改为 `list[dict[str, Any]]`：
```python
async def _load_llm_history_messages_from_leaf(
    self,
    chat_id: uuid.UUID,
    leaf_turn_id: uuid.UUID | None,
    limit: int,
) -> list[dict[str, Any]]:                        # ← 改返回类型
```

局部变量类型（line 1894）：
```python
messages: list[dict[str, Any]] = []               # ← 改类型
```

重建多模态历史（替换 line 1906-1907）：
```python
if t.author_type == AuthorType.USER.value:
    chat_image_refs = (cand.extra or {}).get("chat_images", [])
    if chat_image_refs:
        parts: list[dict[str, Any]] = [{"type": "text", "text": cand.content}]
        for img_ref in chat_image_refs:
            parts.append({"type": "image_url", "image_url": {"url": img_ref["original"]}})
        messages.append({"role": "user", "content": parts})
    else:
        messages.append({"role": "user", "content": cand.content})
elif t.author_type == AuthorType.CHARACTER.value:
    messages.append({"role": "assistant", "content": cand.content})
```

#### 5f. `_candidate_response`（line 191-209）

提取 `chat_images`：
```python
def _candidate_response(
    cand: Candidate,
    *,
    include_learning_data: bool = True,
) -> CandidateResponse:
    extra_payload = _sanitize_candidate_extra(...)
    # 提取 chat_images
    chat_image_data = (cand.extra or {}).get("chat_images")
    chat_images = [ChatImageRef(**img) for img in chat_image_data] if chat_image_data else None
    return CandidateResponse(
        ...,
        chat_images=chat_images,                   # ← 新增
    )
```

---

### Step 6 — 后端：`CharacterLLMRouteService` 新增 vision 路由

**文件：** `src/services/character_llm_route_service.py`

在 `_resolve_flagship_route` 方法之后（line 62 后）新增：
```python
def resolve_vision_route(self) -> ResolvedCharacterLLMRoute:
    """Route to a vision-capable model (dashscope/qwen3.5-flash)."""
    route = self._registry.resolve_bound_route("dashscope", source="vision")
    if route is None or not route.api_key:
        raise APIError(
            status_code=503,
            code="llm_route_unavailable",
            message="dependency unavailable: vision llm provider credentials are missing",
        )
    return route
```

---

### Step 7 — 后端：全链路类型标注修复

将以下位置的 `list[dict[str, str]]` 改为 `list[dict[str, Any]]`，并添加 `from typing import Any` import（若尚未有）：

| 文件 | 行号 | 方法 |
|---|---|---|
| `src/services/chat_service.py` | 1236, 1868, 1894 | `stream_chat_with_prep` 局部变量, `_load_llm_history_messages_from_leaf` 返回值和局部变量 |
| `src/services/character_llm_service.py` | 30 | `chat_stream_messages` 参数 |
| `src/repositories/llm_gateway_repository.py` | 20 | `chat_stream_messages` 参数 |
| `src/services/llm_gateway_service.py` | 66, 225, 331, 459, 573, 719 | `LLMRuntimeClient` Protocol, `_PydanticAIRuntimeClient._build_history`, `_PydanticAIRuntimeClient.chat_stream_messages_async`, `_AnthropicRuntimeClient._convert_messages_for_stream`, `_AnthropicRuntimeClient.chat_stream_messages_async`, `LLMGatewayService.stream_text` |
| `src/memory_system/clients/llm.py` | 150, 220, 240, 244, 363, 393, 495, 508 | `_build_messages` 返回值, `_chat_completion_request_kwargs`, `_message_length_summary`, `_message_count_and_chars`, `_completion_sync_with_fallback`, `_completion_async_with_fallback`, `chat_stream_messages_async`, `_chat_stream_async_messages_with_retries` |

**额外修复 — content 假定为 string 的位置：**

| 文件 | 行号 | 当前代码 | 修改 |
|---|---|---|---|
| `llm_gateway_service.py` | 231 | `content = (message.get("content") or "").strip()` | 增加 `isinstance(content, str)` 检查，list 类型跳过 strip |
| `llm_gateway_service.py` | 464 | `content = (msg.get("content") or "").strip()` | 同上 |
| `llm.py` | 240-241 | `_message_length_summary` 中 `len(message.get("content") or "")` | list content 时用 `str(len(content))` 估算 |

`_PydanticAIRuntimeClient._build_history`（line 224-260）修改示例：
```python
def _build_history(self, messages: list[dict[str, Any]]) -> tuple[str | None, list[...], str]:
    ...
    for message in messages:
        role = (message.get("role") or "").strip().lower()
        raw_content = message.get("content")
        if isinstance(raw_content, list):
            # 多模态消息：提取文本部分
            text_parts = [p["text"] for p in raw_content if isinstance(p, dict) and p.get("type") == "text"]
            content = "\n".join(text_parts)
        else:
            content = (raw_content or "").strip()
        ...
```

`_AnthropicRuntimeClient._convert_messages_for_stream`（line 459-476）修改示例：
```python
def _convert_messages_for_stream(self, messages: list[dict[str, Any]]) -> tuple[str | None, list[dict]]:
    system = None
    anthropic_messages: list[dict] = []
    for msg in messages:
        role = (msg.get("role") or "").strip().lower()
        raw_content = msg.get("content")
        if not raw_content:
            continue
        if role == "system":
            system = raw_content if isinstance(raw_content, str) else str(raw_content)
            continue
        # 处理多模态 content
        if isinstance(raw_content, list):
            anthropic_parts = []
            for part in raw_content:
                if part.get("type") == "text":
                    anthropic_parts.append({"type": "text", "text": part["text"]})
                elif part.get("type") == "image_url":
                    url = part["image_url"]["url"]
                    if url.startswith("data:"):
                        # base64 → 提取 media type 和 data
                        media_type, _, data = url.partition(";base64,")
                        media_type = media_type.replace("data:", "")
                        anthropic_parts.append({"type": "image", "source": {"type": "base64", "media_type": media_type, "data": data}})
                    else:
                        anthropic_parts.append({"type": "image", "source": {"type": "url", "url": url}})
            anthropic_messages.append({"role": role, "content": anthropic_parts})
        else:
            content = raw_content.strip() if isinstance(raw_content, str) else str(raw_content)
            if content:
                anthropic_messages.append({"role": role, "content": [{"type": "text", "text": content}]})
    return system, anthropic_messages
```

注意：vision 路由走的是 dashscope（OpenAI SDK），不会走 Anthropic/PydanticAI 客户端，但为了类型安全仍需修复。

---

### Step 8 — 前端：类型与接口扩展

#### 8a. `src/lib/api-service.ts`

**Line 465-467** — `ChatStreamRequest` 扩展：
```typescript
export interface ChatImageRef {
  original: string;
  display: string;
}

export interface ChatStreamRequest {
  content: string;
  images?: ChatImageRef[];            // ← 新增
}
```

**Line 863** — `MediaUploadKind` 扩展：
```typescript
type MediaUploadKind = "user_avatar" | "character_avatar" | "voice_avatar" | "chat_image";
```

**Line 48-52** — `CompleteUploadResponse` 补充（如果前端有这个类型）：
```typescript
// 需要确认前端是否有这个类型定义，可能需要新增：
interface ChatImageUploadResult {
  upload_id: string;
  image_key: string;
  original_url: string;
  display_url: string;
}
```

#### 8b. `src/components/ChatMessage.tsx`

**Line 18-38** — `Message` 接口扩展：
```typescript
export interface ChatImageRef {
  original: string;
  display: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: ChatImageRef[];             // ← 新增
  // ... 其余字段不变
}
```

---

### Step 9 — 前端：图片上传工具函数

**新增文件：** `src/lib/chat-image-upload.ts`

```typescript
import { apiService } from "./api-service";
import type { ChatImageRef } from "./api-service";

interface ChatImageUploadResult {
  ref: ChatImageRef;
  objectKey: string;
}

export async function uploadChatImage(file: File): Promise<ChatImageUploadResult> {
  // 1. 验证
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) throw new Error("不支持的图片格式");
  if (file.size > 5 * 1024 * 1024) throw new Error("图片大小不能超过 5MB");

  // 2. 调用 presign + upload + complete（复用现有 uploadFile 流程，kind="chat_image"）
  const result = await apiService.uploadFile(file, { kind: "chat_image" });

  // 3. 从 complete 响应中提取 original_url 和 display_url
  return {
    ref: {
      original: result.original_url!,
      display: result.display_url!,
    },
    objectKey: result.image_key,
  };
}

export function validateImageFiles(files: FileList | File[], maxCount: number = 5): {
  valid: File[];
  errors: string[];
} {
  const valid: File[] = [];
  const errors: string[] = [];
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  const maxSize = 5 * 1024 * 1024;

  for (const file of Array.from(files)) {
    if (!allowed.includes(file.type)) { errors.push(`${file.name}: 不支持的格式`); continue; }
    if (file.size > maxSize) { errors.push(`${file.name}: 超过 5MB 限制`); continue; }
    valid.push(file);
    if (valid.length >= maxCount) break;
  }
  return { valid, errors };
}
```

---

### Step 10 — 前端：`ChatInput` 改造

**文件：** `src/components/ChatInput.tsx`

#### 10a. Props 扩展

**Line 26** — `onSend` 签名改为：
```typescript
interface ChatInputProps {
  onSend: (message: string, images?: ChatImageRef[]) => void;    // ← 扩展
  // ... 其余 props 不变
  onAddImages?: (files: File[]) => void;                          // ← 新增：外部处理图片上传
}
```

#### 10b. 图片状态

在组件内部新增 state（line 70 附近）：
```typescript
const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);

interface PendingImage {
  id: string;
  file: File;
  preview: string;           // object URL
  status: "uploading" | "done" | "error";
  ref?: ChatImageRef;
}
```

#### 10c. "+" 按钮 Popover（上方弹出）

替换 line 648 的 `onClick={() => toast("功能开发中")}`：

使用 shadcn `Popover` + `PopoverTrigger` + `PopoverContent side="top"`：

```tsx
<Popover>
  <PopoverTrigger asChild>
    <button data-testid="composer-plus-btn" ...>
      <SpriteIcon name="plus" />
    </button>
  </PopoverTrigger>
  <PopoverContent side="top" align="start" className="w-48 p-1">
    <button
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md hover:bg-accent"
      onClick={() => fileInputRef.current?.click()}
    >
      <PhotoIcon />       {/* 内联 SVG，来自照片.svg */}
      <span>照片</span>
    </button>
  </PopoverContent>
</Popover>
```

复用已存在的隐藏 `<input type="file">`，给其添加 `onChange` handler 和 `ref`。

#### 10d. 输入框上方图片预览区

在 grid layout 的 `header` area 渲染预览（当 `pendingImages.length > 0` 时）：

```tsx
{pendingImages.length > 0 && (
  <div className="flex flex-wrap gap-2 px-3 py-2">
    {pendingImages.map((img) => (
      <div key={img.id} className="relative w-20 h-20">
        <img
          src={img.preview}
          className="w-20 h-20 rounded-xl object-cover cursor-pointer"
          onClick={() => img.status === "done" && openLightbox(img.preview)}
        />
        {img.status === "uploading" && (
          <div className="absolute inset-0 rounded-xl bg-black/10 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          </div>
        )}
        <button
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center"
          onClick={() => removeImage(img.id)}
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    ))}
  </div>
)}
```

#### 10e. 发送逻辑

`handleSend`（line 148-154）修改：
```typescript
const handleSend = () => {
  const text = getEditorText();
  if (!text.trim() && pendingImages.filter(i => i.status === "done").length === 0) return;
  const images = pendingImages
    .filter(i => i.status === "done" && i.ref)
    .map(i => i.ref!);
  onSend(text, images.length > 0 ? images : undefined);
  setPendingImages([]);
};
```

---

### Step 11 — 前端：`ChatMessage` 图片展示

**文件：** `src/components/ChatMessage.tsx`

在用户消息渲染（line 399-404）的 `<p>` 标签之前，插入图片网格：

```tsx
{/* 用户消息图片网格 */}
{message.images && message.images.length > 0 && (
  <ImageGrid
    images={message.images}
    onImageClick={(index) => setLightboxState({ open: true, index })}
  />
)}
<p className="whitespace-pre-wrap">{message.content}</p>
```

新增 `ImageGrid` 子组件（同文件内或独立文件）：

```tsx
function ImageGrid({ images, onImageClick }: {
  images: ChatImageRef[];
  onImageClick: (index: number) => void;
}) {
  const isMobile = useIsMobile();
  const cols = isMobile ? 2 : 3;
  const rows = layoutImages(images, cols);

  return (
    <div className="flex flex-col gap-1 mb-2">
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className="flex gap-1">
          {row.map((img, colIdx) => {
            const globalIdx = /* 计算 */ ;
            return (
              <img
                key={colIdx}
                src={img.display}
                className="aspect-square rounded-xl object-cover flex-1 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => onImageClick(globalIdx)}
                loading="lazy"
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function layoutImages(images: ChatImageRef[], cols: number): ChatImageRef[][] {
  const rows: ChatImageRef[][] = [];
  const remainder = images.length % cols;
  let idx = 0;
  if (remainder > 0) {
    rows.push(images.slice(0, remainder));
    idx = remainder;
  }
  while (idx < images.length) {
    rows.push(images.slice(idx, idx + cols));
    idx += cols;
  }
  return rows;
}
```

---

### Step 12 — 前端：`useChatSession` 扩展

**文件：** `src/hooks/useChatSession.ts`

#### 12a. `handleSendMessage` 签名

**Line 1435** — 扩展参数：
```typescript
async (content: string, images?: ChatImageRef[]) => {
```

#### 12b. 构造用户消息

**Line 1455-1461** — 添加 images 字段：
```typescript
const userMessage: Message = {
  id: tempUserId,
  role: "user",
  content,
  images: images && images.length > 0 ? images : undefined,    // ← 新增
  isTemp: true,
};
```

#### 12c. API 调用

**Line 1490-1492** — 传递 images：
```typescript
await streamChatMessage(
  chatId,
  { content, images },    // ← 传递 images
  { ...handlers },
);
```

#### 12d. `mapTurnsPageMessage`

**Line 102-136** — 映射图片数据：
```typescript
const mapTurnsPageMessage = (turn: TurnsPageResponse["turns"][number]): Message => {
  ...
  return {
    ...现有字段,
    images: turn.primary_candidate.chat_images ?? undefined,    // ← 新增
  };
};
```

---

### Step 13 — 前端：全局拖拽支持

**文件：** `src/components/ChatMainFrame.tsx`

在主容器上添加 drag/drop 事件处理：

```tsx
const [isDragging, setIsDragging] = useState(false);
const dragCounter = useRef(0);

const handleDragEnter = (e: React.DragEvent) => {
  e.preventDefault();
  dragCounter.current++;
  if (e.dataTransfer.types.includes("Files")) setIsDragging(true);
};
const handleDragLeave = (e: React.DragEvent) => {
  e.preventDefault();
  dragCounter.current--;
  if (dragCounter.current === 0) setIsDragging(false);
};
const handleDragOver = (e: React.DragEvent) => e.preventDefault();
const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  dragCounter.current = 0;
  setIsDragging(false);
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
  if (files.length > 0) onDropImages?.(files);
};
```

需要 props 新增 `onDropImages?: (files: File[]) => void`，并在覆盖层显示拖拽提示。

**调用方**（chat page）将 `onDropImages` 连接到 ChatInput 的图片添加逻辑。

---

### Step 14 — 前端：Lightbox 图片查看器

**新增文件：** `src/components/ImageLightbox.tsx`

```tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

export function ImageLightbox({ images, initialIndex = 0, open, onClose }: ImageLightboxProps) {
  const [current, setCurrent] = useState(initialIndex);

  useEffect(() => { setCurrent(initialIndex); }, [initialIndex]);

  const prev = useCallback(() => setCurrent(i => (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setCurrent(i => (i + 1) % images.length), [images.length]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, prev, next, onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-black/90 border-none max-w-full w-full h-full max-h-full rounded-none flex items-center justify-center p-0">
        {/* 关闭按钮 */}
        <button onClick={onClose} className="absolute top-4 right-4 z-50 text-white/70 hover:text-white">
          <X className="w-6 h-6" />
        </button>
        {/* 序号 */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
          {current + 1} / {images.length}
        </div>
        {/* 图片 */}
        <img src={images[current]} className="max-w-[90vw] max-h-[85vh] object-contain" />
        {/* 切换按钮 */}
        {images.length > 1 && (
          <>
            <button onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white">
              <ChevronLeft className="w-8 h-8" />
            </button>
            <button onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white">
              <ChevronRight className="w-8 h-8" />
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

**使用位置：**
1. `ChatInput` — 预览区图片点击 → `openLightbox(previewUrl)`
2. `ChatMessage` — 消息图片网格点击 → `openLightbox(images.map(i => i.original), index)`

---

## Non-goals

- 不做图片编辑/裁剪
- 不支持视频/文件上传（仅图片）
- 不支持 assistant 消息中的图片生成
- 不修改 DeepSeek 模型本身的功能
- 不做图片的 OCR / 文字提取等专项处理
- 不修改 TTS、记忆、学习等相关模块

---

## 验证与验收标准

### 后端测试

1. 单元测试：`ChatStreamRequest` 带 `images` 字段的验证（空列表、超过 5 张）
2. 单元测试：`_load_llm_history_messages_from_leaf()` 能正确重建多模态历史
3. 单元测试：`_candidate_response()` 正确提取 `chat_images`
4. 集成测试：发送带 1 张图片的消息，验证 qwen3.5-flash 被调用，返回包含图片描述的回复
5. 集成测试：发送带 5 张图片的消息，验证全部传递给 LLM
6. 验证 `model_type_label` 正确反映使用的模型（`dashscope:vision:qwen3.5-flash`）
7. 验证 `complete_upload` 对 `chat_image` kind 生成 AVIF 展示图

### 前端测试

1. 点击 "+" → 上方弹出 Popover → 点击"照片" → 文件选择器打开 → 选择图片
2. 图片在输入框上方显示加载状态 → 加载完成变清晰
3. 点击预览区图片 → 打开 Lightbox 查看大图
4. 发送后用户消息气泡上方显示图片网格
5. 点击消息中的图片 → 打开 Lightbox 查看原图，可左右切换
6. 5 张图布局验证：上面 2 张 + 下面 3 张
7. 拖拽图片到聊天区域 → 触发上传
8. Mobile 布局验证：一行 2 张
9. 超过 5 张时拒绝/提示
10. 所有图片为正方形展示

### E2E 验证

1. 完整流程：上传图片 → 发送 → 模型回复包含对图片的描述
2. 发送纯文本消息 → 仍走 deepseek 模型
3. 混合发送：先发文字，再发图片，再发文字 → 历史消息正确加载
4. 关闭聊天页面 → 重新打开 → 历史消息中的 AVIF 展示图仍然显示
5. 点击历史消息中的图片 → Lightbox 加载原图正常打开

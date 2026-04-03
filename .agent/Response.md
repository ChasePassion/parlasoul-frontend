# role-playing 响应与错误处理（当前前端实现）

更新时间：2026-04-03

## 1. 成功响应处理

`src/lib/http-client.ts` 当前使用以下成功处理规则：

- 优先按统一成功包裹解包：

```json
{
  "code": "ok",
  "message": "ok",
  "status": 200,
  "data": {}
}
```

- 如果返回体不是这个结构，前端直接把原 JSON 视为业务数据
- `204 No Content`
  - 返回 `undefined`

## 2. 错误类

前端当前只有两类核心错误对象：

### 2.1 `UnauthorizedError`

- 默认 message：`authorization failed`
- 语义：
  - 登录态失效
  - token 无效
  - 需要重新登录

### 2.2 `ApiError`

结构：

```ts
new ApiError(status, code?, detail?)
```

字段：

- `status`
- `code?`
- `detail?`

## 3. `httpClient` 的失败处理

`httpClient` 当前失败处理逻辑：

- 读取失败 JSON 中的：
  - `code`
  - `message`
  - `detail`
- 若 HTTP `401`
  - 清空本地 token
  - 抛出 `UnauthorizedError`
- 其他非 2xx
  - 抛出 `ApiError(status, code, message)`

这套规则用于全部普通 JSON 请求。

## 4. 手写 `fetch` 的失败处理

SSE / 二进制 / `FormData` 接口虽然不用 `httpClient`，但错误口径保持一致：

- `401`
  - 清 token
  - 抛 `UnauthorizedError`
- 其他错误
  - 抛 `ApiError`

其中 STT 额外约定：

- HTTP `422`
  - 抛 `ApiError(422, errorData.code ?? "no_speech", errorMessage)`

## 5. 鉴权状态传播

- `tokenStore` 是前端鉴权状态的唯一本地源
- `AuthProvider` 会：
  - 首次启动时从 `localStorage` 读 token
  - token 变化时重新调用 `/v1/auth/me`

因此任意接口返回 `401` 后，整站会进入下面这条恢复链路：

1. 清除本地 token
2. `AuthProvider` 用户态归零
3. 受保护页面回退到未登录状态
4. 页面重新跳转 `/login`

## 6. SSE 与二进制响应

### 6.1 SSE

下面 3 个接口按 `text/event-stream` 解析：

- `/v1/chats/{chat_id}/stream`
- `/v1/turns/{turn_id}/regen/stream`
- `/v1/turns/{turn_id}/edit/stream`

当前解析规则：

- 只处理以 `data:` 开头的行
- 每一行尝试做 JSON.parse
- 解析失败的行直接忽略

SSE 错误事件当前口径：

```json
{
  "type": "error",
  "code": "...",
  "message": "..."
}
```

### 6.2 二进制

下面 2 个接口返回 `ArrayBuffer`：

- `/v1/voice/tts/messages/{assistant_candidate_id}/audio`
- `/v1/voices/{voice_id}/preview/audio`

### 6.3 `FormData`

下面 2 个接口当前走 `FormData`：

- `/v1/voice/stt/transcriptions`
- `/v1/voices/clones`

## 7. 错误映射入口

错误文案映射集中在：

- `src/lib/error-map.ts`

映射输出统一为：

```ts
{
  code: string;
  message: string;
  severity: "error" | "warning" | "info";
  rawMessage?: string;
}
```

公开辅助函数：

- `mapApiError`
- `getErrorMessage`
- `isSevereError`

## 8. 错误映射策略

当前映射顺序是：

1. 如果是 `ApiError`
   - 优先取 `code`
   - 再回退到 HTTP `status`
2. 如果 `detail` 里包含阿里云上游字段
   - 解析 `upstream_code`
   - 映射到阿里云语音专用文案
3. 如果是普通 `Error`
   - 先看是否命中已知运行时错误码
   - 再判断是否是网络错误
4. 最终回退到默认文案

当前还专门处理了：

- `authorization failed:*`
- `fetch`
- `network`
- `Failed to fetch`

## 9. 当前已映射的错误类别

### 9.1 通用状态码

- `400`
- `401`
- `403`
- `404`
- `409`
- `422`
- `429`
- `500`
- `502`
- `503`

### 9.2 通用运行时错误

- `DEFAULT`
- `NETWORK_ERROR`
- `UNKNOWN`
- `unauthorized`
- `authorization failed`
- `No response body`
- `Unknown error`

### 9.3 麦克风与 STT

- `MIC_PERMISSION_DENIED`
- `MIC_DEVICE_NOT_FOUND`
- `MIC_DEVICE_BUSY`
- `MIC_INSECURE_CONTEXT`
- `MIC_API_UNAVAILABLE`
- `MIC_START_FAILED`
- `NO_SPEECH`
- `STT.NoSpeech`
- `STT.TranscriptionFailed`

### 9.4 音色 / TTS / 语音上游错误

- `voice_profile_not_selectable`
- `voice_profile_not_ready`
- `voice_preview_text_missing`
- `voice_preview_not_supported`
- `voice_not_found`
- `TTS.VoiceNotReady`
- `TTS.VoiceNotFound`

### 9.5 阿里云音频预处理错误

- `Audio.DurationLimitError`
- `Audio.FormatError`
- `Audio.QualityError`
- `Audio.FileTooLargeError`
- `Audio.PreprocessError`
- `Audio.SilentAudioError`
- `Audio.SpeechNotDetectedError`

### 9.6 音色克隆流程错误

- `VoiceClone.CreateFailed`
- `VoiceClone.ProcessingFailed`

## 10. 前端如何落错误状态

### 10.1 页面与弹窗

下面这些页面 / 弹窗直接展示 `getErrorMessage(err)`：

- 登录页
- setup 页
- 创建 / 编辑角色
- 创建 / 编辑音色
- 音色选择器
- 音色管理对话框

### 10.2 用户设置

`UserSettingsProvider` 暴露：

- `isLoading`
- `isSaving`
- `error`
- `retrySync`

`SettingsModal` 用 badge 展示：

- 加载中
- 同步中
- 同步失败
- 已自动同步

### 10.3 聊天消息级错误

- reply card
  - 使用 `replyCardStatus` + `replyCardErrorCode`
- feedback card
  - 使用每条消息独立的 `FeedbackCardState`
- 主聊天流 / regen / edit
  - 错误会落回 assistant 消息内容区域
  - 流结束后视情况重新拉 snapshot 校正

### 10.4 收藏失败

- 收藏相关操作使用 optimistic update
- 失败时回滚到旧状态

### 10.5 音频相关失败

- 手动朗读失败
  - 当前主要通过控制台记录并复位加载态
- 音色试听失败
  - `audioPreviewManager` 会复位全局播放状态

## 11. 恢复与回滚行为

当前前端显式做了这些恢复动作：

- `401`
  - 清 token
- 设置同步失败
  - 保留本地状态
  - 允许重试同步
- 收藏失败
  - 回滚 optimistic state
- 聊天流失败
  - 把错误文本落进临时 assistant 消息
  - 再按条件重新拉 snapshot
- 麦克风取消
  - 录音状态回到 `default`
- 播放器失败
  - 清空 active 播放状态

## 12. 当前前端约束

- 页面优先展示中文映射文案，而不是服务端原始英文错误。
- `rawMessage` 仅保留给调试，不作为最终用户主文案。
- 任何新增错误码，如果希望在 UI 中可读，必须同步更新 `src/lib/error-map.ts`。

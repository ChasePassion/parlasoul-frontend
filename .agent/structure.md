# ParlaSoul 前端架构说明

更新时间：2026-04-14

## 1. 仓库定位

- 仓库路径：`E:\code\parlasoul-frontend`
- 这是 ParlaSoul 的 Next.js 前端仓库。
- 当前前端不是单纯的“页面壳”，而是同时承担三类职责：
  - 浏览器 UI 与交互状态
  - `better-auth` 认证与 Dodo 托管计费入口
  - 少量 Next.js Server Route 能力

当前前端直接拥有的 HTTP 面：

- `/api/auth/*`
- `/api/auth/email-otp-status`
- `/api/share-card-image`
- `/api/logs`

当前前端不直接拥有：

- `/v1/*` 业务接口
- `/uploads/*` 静态文件目录
- 数据库 schema / Alembic / FastAPI 服务

## 2. 技术栈

- Next.js 15 App Router
- React 19
- TypeScript 5
- Tailwind CSS 4
- shadcn/ui + Radix
- better-auth
- Dodo Payments SDK
- Redis
- Recharts
- Embla Carousel
- `react-markdown` / `remark-gfm` / `remark-breaks`

## 架构图

```mermaid
flowchart TD
    Browser[浏览器 / 用户] --> Middleware[src/middleware.ts<br/>受保护路由跳转]
    Middleware --> Root[RootLayout<br/>fonts + AuthProvider]

    subgraph NextApp[Next.js App Router]
        Root --> PublicPages[公开页面<br/>/login /setup /pricing]
        Root --> AppLayout["src/app/(app)/layout.tsx"]
        AppLayout --> AppFrame[AppFrame + Sidebar]
        AppLayout --> SidebarCtx[SidebarContext]
        AppLayout --> SettingsCtx[UserSettingsProvider]
        AppLayout --> GrowthCtx[GrowthProvider]
        AppLayout --> ProtectedPages["受保护页面<br/>/ /chat/[id] /favorites /profile /billing /stats"]
    end

    subgraph UI[页面与组件层]
        Discover[Discover Page<br/>TopConsole / HeroCarousel / HorizontalSection]
        ChatPage[Chat Page<br/>ChatHeader / ChatThread / ChatInput / ChatHistorySidebar / MessageNavigator]
        Profile[Profile Page<br/>Character / Voice 管理]
        Billing[Pricing + Billing]
        Stats[Stats Page]
        ProtectedPages --> Discover
        ProtectedPages --> ChatPage
        ProtectedPages --> Profile
        ProtectedPages --> Billing
        ProtectedPages --> Stats
    end

    subgraph State[共享状态与交互编排]
        AuthCtx[auth-context.tsx<br/>session -> user + entitlements]
        ChatHook[useChatSession]
        SidebarHook[useSidebarShell]
        GrowthState[growth-context.tsx]
        SettingsState[user-settings-context.tsx]
        Root --> AuthCtx
        AppLayout --> SidebarHook
        AppLayout --> GrowthState
        AppLayout --> SettingsState
        ChatPage --> ChatHook
        ChatPage --> GrowthState
        ChatPage --> SettingsState
        Profile --> AuthCtx
        Billing --> AuthCtx
        Stats --> GrowthState
    end

    subgraph ClientAPI[前端 API 与客户端能力]
        APIIndex[api.ts<br/>统一导出层]
        APIService[api-service.ts<br/>/v1 封装 + SSE + 二进制]
        HttpClient[http-client.ts]
        BetterAuthClient[auth-client.ts / auth.ts<br/>better-auth + Dodo]
        GrowthAPI[growth-api.ts]
        BillingAPI[dodo-payments.ts]
        Adapters[character-adapter / voice-adapter / llm-adapter / chat-helpers / discover-data]
        Audio[stt-recorder / tts-playback-manager / audio-preview-manager]
        ChatHook --> APIIndex
        Discover --> APIIndex
        Profile --> APIIndex
        Billing --> APIIndex
        Stats --> GrowthAPI
        APIIndex --> APIService
        APIIndex --> BetterAuthClient
        APIIndex --> GrowthAPI
        Billing --> BillingAPI
        ChatPage --> Audio
        Discover --> Adapters
    end

    subgraph RouteHandlers[前端内部 Route Handlers]
        AuthRoute["/api/auth/*"<br/>better-auth handler]
        OTPRoute["/api/auth/email-otp-status"]
        ShareRoute["/api/share-card-image"]
        LogRoute["/api/logs"]
        BetterAuthClient --> AuthRoute
        PublicPages --> OTPRoute
        ProtectedPages --> ShareRoute
        ProtectedPages --> LogRoute
    end

    subgraph Rewrites[Next.js Rewrite / 同源代理]
        V1Rewrite["/v1/* -> backend"]
        UploadRewrite["/uploads/* -> backend"]
    end
    HttpClient --> V1Rewrite
    APIService --> V1Rewrite
    UI --> UploadRewrite

    subgraph External[外部系统]
        Backend[ParlaSoul Backend<br/>/v1 + /uploads]
        BetterAuthInfra[better-auth<br/>Cookie / JWT / JWKS]
        Dodo[Dodo Payments]
        Redis[(Redis<br/>OTP 状态 + 分享卡图片缓存)]
        LogFiles[(logs/*.log)]
        ShareRemote[远程分享图片源]
        V1Rewrite --> Backend
        UploadRewrite --> Backend
        AuthRoute --> BetterAuthInfra
        BetterAuthClient --> Dodo
        BillingAPI --> Dodo
        OTPRoute --> Redis
        ShareRoute --> Redis
        ShareRoute --> ShareRemote
        LogRoute --> LogFiles
    end
```

图的阅读重点：

- 公开页面和受保护页面共用 `AuthProvider`，但只有 `(app)` 布局会继续挂载 Sidebar、Growth、UserSettings 三个共享运行时。
- 页面本身不直接散落 `fetch`；业务请求统一穿过 `api.ts -> api-service.ts / auth.ts`，再分别进入 `/v1/*` rewrite 或前端 route handlers。
- 聊天页的复杂度主要收敛在 `useChatSession` 与音频控制器，而不是散落在 `page.tsx`。
- 前端不仅消费后端 API，还直接拥有 `better-auth`、Dodo、Redis 缓存图片代理、前端日志落盘这几条内部服务链路。

## 3. 顶层运行结构

### 3.1 根布局

- `src/app/layout.tsx`
  - 注册本地字体
  - 全局挂载 `AuthProvider`

### 3.2 受保护应用壳

- `src/app/(app)/layout.tsx`
  - 使用 `AppFrame` 装配侧边栏与主工作区
  - 维护 `SidebarContext`
  - 挂载：
    - `UserSettingsProvider`
    - `GrowthProvider`
    - `CheckInCalendarDialog`

### 3.3 路由守卫

- `src/middleware.ts`
  - 保护：
    - `/`
    - `/chat/*`
    - `/favorites`
    - `/profile`
    - `/setup`
    - `/billing`
  - 基于 better-auth session cookie 判断是否需要跳转 `/login`

### 3.4 后端代理

- `next.config.ts`
  - rewrite `/v1/* -> backend`
  - rewrite `/uploads/* -> backend`
  - 对 `/v1/*` 注入 `Cache-Control: no-cache, no-transform`
  - `compress=false`，避免 SSE 被代理缓冲

## 4. 目录分层

### 4.1 `src/app`

职责：

- 路由入口
- App Router 布局
- 少量 route handlers

当前页面入口：

- `src/app/login/page.tsx`
- `src/app/setup/page.tsx`
- `src/app/pricing/page.tsx`
- `src/app/(app)/page.tsx`
- `src/app/(app)/chat/[id]/page.tsx`
- `src/app/(app)/favorites/page.tsx`
- `src/app/(app)/profile/page.tsx`
- `src/app/(app)/billing/page.tsx`
- `src/app/(app)/stats/page.tsx`

当前 route handlers：

- `src/app/api/auth/[...all]/route.ts`
- `src/app/api/auth/email-otp-status/route.ts`
- `src/app/api/share-card-image/route.ts`
- `src/app/api/logs/route.ts`

### 4.2 `src/components`

职责：

- 页面级业务组件
- 业务弹窗
- 聊天视图
- Growth / Billing / Voice 子模块

当前主要子目录：

- `billing`
- `chat`
- `growth`
- `layout`
- `ui`
- `voice`

### 4.3 `src/hooks`

职责：

- 封装交互状态和视图协作

当前关键 hook：

- `useChatSession`
- `useRealtimeVoiceSession`
- `useDismissiblePopover`
- `useOptimisticFavorite`
- `useSidebarShell`

### 4.4 `src/lib`

职责：

- API client
- better-auth 客户端
- 共享 context
- 适配器与纯函数工具
- 音频控制器
- Growth/Billing 辅助

当前关键模块：

- API 与鉴权
  - `api.ts`
  - `api-service.ts`
  - `http-client.ts`
  - `auth.ts`
  - `auth-client.ts`
  - `auth-context.tsx`
  - `better-auth-token.ts`
- 共享状态
  - `user-settings-context.tsx`
  - `growth-context.tsx`
- 业务辅助
  - `discover-data.ts`
  - `chat-helpers.ts`
  - `growth-api.ts`
  - `dodo-payments.ts`
  - `billing-plans.ts`
- Realtime
  - `realtime/realtime-voice-session-client.ts`
- 适配器
  - `character-adapter.ts`
  - `voice-adapter.ts`
  - `llm-adapter.ts`
- 音频
  - `voice/stt-recorder.ts`
  - `voice/tts-playback-manager.ts`
  - `voice/audio-preview-manager.ts`
- 日志
  - `logger/*`

## 5. 页面与业务模块

### 5.1 登录与认证

页面：

- `src/app/login/page.tsx`

当前能力：

- 邮箱 OTP 登录
- 邮箱密码注册/登录
- Google 登录
- OTP 投递状态轮询

相关模块：

- `authClient`
- `AuthProvider`
- `src/app/api/auth/[...all]/route.ts`
- `src/app/api/auth/email-otp-status/route.ts`

### 5.2 Setup

页面：

- `src/app/setup/page.tsx`

当前能力：

- 用户名填写
- 头像裁剪
- 通用文件上传
- 保存用户资料

相关模块：

- `AvatarCropper`
- `uploadFile`
- `updateUserProfile`

### 5.3 Discover

页面：

- `src/app/(app)/page.tsx`

当前能力：

- Discover 配置拉取
- 市场角色全量分页拉取
- 本地搜索
- Hero 角色轮播
- 点角色后 get-or-create chat

相关模块：

- `TopConsole`
- `HeroCarousel`
- `HorizontalSection`
- `discover-data.ts`
- `chat-helpers.ts`

### 5.4 聊天

页面：

- `src/app/(app)/chat/[id]/page.tsx`

这是当前前端最重的业务页面，主要由这些部分组成：

- `ChatHeader`
- `ChatThread`
- `ChatInput`
- `ChatHistorySidebar`
- `MessageNavigator`
- `ShareCardDialog`
- 隐藏的远端 `<audio>`

核心状态中心：

- `useChatSession`
- `useRealtimeVoiceSession`

它负责：

- 拉取 snapshot
- 维护消息数组
- 发起三条流：
  - 新消息
  - regen
  - 用户改写
- 管理候选切换
- 管理向上分页
- 处理 reply suggestions / reply card / TTS / growth SSE

新增的 realtime 通话能力：

- 通过 `RealtimeVoiceSessionClient` 发起 `/v1/realtime/session`
- 在聊天页输入区内建立 inline WebRTC 会话状态机
- 展示用户与角色的双向字幕，并刷新聊天线程
- 管理挂断按钮、收音开关和 speaking 态按钮视觉

### 5.5 收藏

页面：

- `src/app/(app)/favorites/page.tsx`

当前能力：

- 收藏分页
- 删除收藏
- 当前只展示：
  - `reply_card`
  - `word_card`
  - `feedback_card`

### 5.6 个人中心

页面：

- `src/app/(app)/profile/page.tsx`

拆成两个标签页：

- 角色
- 音色

角色相关：

- `CreateCharacterModal`
- `CharacterCard`
- `DeleteConfirmDialog`

音色相关：

- `CreateVoiceCloneModal`
- `EditVoiceModal`
- `VoiceCard`
- `VoiceSelector`
- `VoiceUsageManagerDialog`

### 5.7 定价与账单

页面：

- `src/app/pricing/page.tsx`
- `src/app/(app)/billing/page.tsx`

当前架构是“双轨支付入口”：

- 订阅
  - better-auth + Dodo 托管 checkout / portal / subscriptions / payments
- 微信一次性权益
  - 走后端 `/v1/payments/*`

关键模块：

- `src/lib/dodo-payments.ts`
- `src/lib/billing-plans.ts`
- `PricingPageContent`
- `BillingPageContent`

### 5.8 Growth / Stats

页面：

- `src/app/(app)/stats/page.tsx`

当前能力：

- KPI 卡片
- 阅读等价
- 趋势图
- 角色台账

全局 Growth 状态由 `GrowthProvider` 维护：

- 进站签到弹窗
- 今日成长摘要
- 分享卡队列
- calendar month 状态

## 6. 共享状态与运行时协作

### 6.1 `AuthProvider`

职责：

- 管理 better-auth session 到前端 `User` 的映射
- 维护 `entitlements`
- 暴露：
  - `login`
  - `logout`
  - `refreshUser`
  - `refreshEntitlements`

### 6.2 `UserSettingsProvider`

职责：

- 先读本地 `user_settings_v2`
- 再拉远端 `/v1/users/me/settings`
- 变更后 400ms debounce 回写远端

设置项包括：

- `messageFontSize`
- `displayMode`
- `memoryEnabled`
- `replyCardEnabled`
- `mixedInputAutoTranslateEnabled`
- `autoReadAloudEnabled`
- `preferredExpressionBiasEnabled`

### 6.3 `GrowthProvider`

职责：

- 拉取 `growth/entry`
- 维护签到弹窗可见性
- 维护待消费分享卡
- 同步 today summary / makeup balance / calendar day

### 6.4 `SidebarContext`

职责：

- 统一维护 sidebar 开关
- 当前用户已有聊天角色列表
- 当前选中的角色

## 7. API 与数据流

### 7.1 `api-service.ts`

这是前端对后端 `/v1/*` 的主客户端封装层。

职责：

- 定义请求/响应类型
- 封装 CRUD 请求
- 封装 SSE 解析
- 封装二进制与表单请求

### 7.2 `api.ts`

职责：

- 向上提供稳定导出
- 同时补上 better-auth / Dodo 的客户端能力

因此现在的前端 API 层实际上分为两块：

- `better-auth` / Dodo 客户端面
- 后端 `/v1/*` HTTP 客户端面

### 7.3 `http-client.ts`

职责：

- 统一 JSON 请求
- 统一成功包裹解包
- 统一错误映射到 `ApiError` / `UnauthorizedError`

## 8. 音频与流式子系统

### 8.1 STT

- `voice/stt-recorder.ts`
- 录音后走 `/v1/voice/stt/transcriptions`

### 8.1.1 Realtime 通话

- `lib/realtime/realtime-voice-session-client.ts`
- `hooks/useRealtimeVoiceSession.ts`
- `components/ChatInput.tsx`
- `app/(app)/chat/[id]/page.tsx`

当前职责：

- 建立浏览器 WebRTC 连接
- 管理 DataChannel 控制事件
- 订阅远端 bot 音频
- 维护 realtime 字幕状态
- 把会话状态投影到聊天页输入区，而不是独立弹窗

### 8.2 TTS

- `voice/tts-playback-manager.ts`
- 负责：
  - 单条消息音频播放
  - SSE 实时 TTS chunk 播放
  - 全局互斥与中断

### 8.3 试听音频

- `voice/audio-preview-manager.ts`
- 管理音色试听全局互斥

## 9. 内部 Route Handler 子系统

### 9.1 `better-auth`

- `src/app/api/auth/[...all]/route.ts`
- 统一把 `better-auth` handler 暴露为 Next.js Route Handler

### 9.2 OTP 状态查询

- `src/app/api/auth/email-otp-status/route.ts`
- 登录页轮询邮件发送状态

### 9.3 分享卡图片代理

- `src/app/api/share-card-image/route.ts`
- 用 Redis 缓存远程图片
- 解决分享卡图片拉取与跨域/缓存问题

### 9.4 前端日志落盘

- `src/app/api/logs/route.ts`
- 把结构化日志写到 `logs/{module}.log`

## 10. 当前前端架构边界

- 前端不直接连数据库。
- 前端没有自己的 `/v1/*` mock 层。
- 正式业务数据都来自后端 `/v1/*` 或 better-auth/Dodo 托管能力。
- 当前 Next.js route handlers 只用于认证、日志、分享卡图片代理，不承载业务 CRUD。
- `/pricing` 是公开页面，`/billing` 是受保护页面；两者都不在后端仓库。
- 聊天主链路已经是“流式 + 聊天树 + 学习卡 + TTS + Growth 事件”的复合页面，不应再按简单消息列表理解。
- realtime 通话当前依附 `/chat/[id]` 页面，不新增前端 route handler，也不引入独立通话页面模板。

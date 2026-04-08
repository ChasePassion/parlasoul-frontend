# parlasoul 项目说明（当前前端实现）

更新时间：2026-04-03

## 1. 仓库定位

- 仓库路径：`E:\code\parlasoul-frontend`
- 这是 NeuraChar 的 Next.js 前端仓库，不包含 FastAPI、Alembic、数据库迁移、数据库模型或后端运维脚本。
- 仓库当前职责只有两类：
  1. 消费 `/v1/*` API 与 `/uploads/*` 静态资源
  2. 把角色发现、聊天、学习辅助、收藏、角色管理、音色管理这些浏览器端链路落地

当前前端没有：

- Next.js API Route
- Server Action
- 独立后端 mock 层
- 本地数据库
- 已启用的调试页面或沙盒页面

## 2. 技术栈

- Next.js 15 App Router
- React 19
- TypeScript 5
- Tailwind CSS 4
- shadcn/ui + Radix
- `react-markdown` + `remark-gfm` + `remark-breaks`
- Embla Carousel
- Lucide React

依赖与脚本来源：`package.json`

- `pnpm dev`
  - 本地开发，端口 `3001`
- `pnpm build`
  - 生产构建
- `pnpm lint`
  - ESLint

当前仓库有单测文件：

- `src/lib/chat-turn-snapshot.test.ts`
- `src/lib/character-avatar.test.ts`
- `src/lib/hero-carousel-tween.test.ts`

但 `package.json` 目前没有 `test` script。

## 3. 运行与代理

`next.config.ts` 当前做了 3 件关键事情：

1. 禁用 `compress`
   - 目的是避免代理层缓冲 SSE
2. rewrite `/uploads/:path*`
   - 到 `http://localhost:8000/uploads/:path*`
3. rewrite `/v1/:path*`
   - 到 `http://localhost:8000/v1/:path*`

同时给 `/v1/:path*` 注入：

```text
Cache-Control: no-cache, no-transform
```

这是为了让聊天流、regen 流、edit 流在代理层保持增量刷出。

## 4. 目录结构

### 4.1 页面层

当前 `src/app` 实际只包含这些页面入口：

- `src/app/layout.tsx`
- `src/app/login/page.tsx`
- `src/app/setup/page.tsx`
- `src/app/(app)/layout.tsx`
- `src/app/(app)/page.tsx`
- `src/app/(app)/chat/[id]/page.tsx`
- `src/app/(app)/favorites/page.tsx`
- `src/app/(app)/profile/page.tsx`

也就是说，当前正式页面只有：

- `/login`
- `/setup`
- `/`
- `/chat/[id]`
- `/favorites`
- `/profile`

### 4.2 组件层

- `src/components/*`
  - 顶层业务组件
- `src/components/chat/*`
  - 聊天线程、聊天历史、消息导航
- `src/components/voice/*`
  - 音色卡片、克隆、编辑、试听、角色绑定管理
- `src/components/layout/*`
  - AppFrame / WorkspaceFrame / ChatMainFrame
- `src/components/ui/*`
  - shadcn 与通用 UI 壳

### 4.3 hooks 与 lib

- `src/hooks/*`
  - 以交互状态与视图辅助为主
- `src/lib/*`
  - API client、DTO、鉴权、适配器、音频控制器、纯函数工具

## 5. 页面与用户链路

### 5.1 登录与首次设置

`/login`

- 邮箱验证码两步登录
- 成功后会拉 `/v1/auth/me`
- 根据资料是否完整跳转：
  - 完整 -> `/`
  - 不完整 -> `/setup`

`/setup`

- 填写用户名
- 上传并裁剪头像
- 通过 `/v1/upload` 上传文件
- 通过 `PUT /v1/users/me` 完成资料保存

### 5.2 Discover

`/`

- 页面主体由 `TopConsole`、`HeroCarousel`、`HorizontalSection` 组成
- `TopConsole`
  - 本地搜索市场角色
  - 切换 `character / story`
- `character` 模式
  - 展示 Hero 角色与全量角色横滑区
- `story` 模式
  - 目前只是 `ComingSoonPage`

数据来源：

- `/v1/discover/config`
- `/v1/characters/market`

### 5.3 聊天

`/chat/[id]`

页面由这些核心块组成：

- `ChatHeader`
- `ChatThread`
- `ChatInput`
- `ChatHistorySidebar`
- `MessageNavigator`

主要能力：

- 加载当前 active branch 的 turn snapshot
- 新消息 SSE
- regen assistant SSE
- user edit SSE
- 候选切换
- 向上滚动分页拉旧消息
- 回复卡、单词卡、更好表达
- 手动朗读与实时自动朗读

### 5.4 收藏

`/favorites`

- 只展示 3 类收藏：
  - `reply_card`
  - `word_card`
  - `feedback_card`
- 支持分页加载与删除

### 5.5 个人中心

`/profile`

分成两个 tab：

- 角色
  - 我的角色列表
  - 创建角色
  - 编辑角色
  - 删除角色
- 音色
  - 我的音色分页
  - 创建克隆音色
  - 编辑音色
  - 删除音色
  - 管理音色绑定的角色

## 6. 应用壳与路由保护

### 6.1 RootLayout

`src/app/layout.tsx`

- 注入 `Inter` 与 `Noto Sans SC`
- 全局挂载 `AuthProvider`

### 6.2 AppLayout

`src/app/(app)/layout.tsx`

负责 4 件事：

1. 检查是否已登录
2. 检查用户资料是否完整
3. 装配 Sidebar 与主工作区
4. 挂载 `UserSettingsProvider`

当前受保护页面是：

- `/`
- `/chat/[id]`
- `/favorites`
- `/profile`

未登录跳转 `/login`，资料不完整跳转 `/setup`。

### 6.3 SidebarShell

`useSidebarShell`

- 桌面默认展开
- `window.innerWidth < 800` 时切为移动端 overlay 侧边栏

## 7. 全局状态与本地持久化

### 7.1 Auth

- `tokenStore`
  - 持久化 `access_token`
- `AuthProvider`
  - 初始化用户
  - 监听 token 变化
  - 暴露 `login` / `logout` / `refreshUser`

### 7.2 User Settings

- `UserSettingsProvider`
  - 先读本地 `user_settings_v2`
  - 再拉远端 `/v1/users/me/settings`
  - 用 400ms debounce 回写远端

本地保存的设置字段：

- `messageFontSize`
- `displayMode`
- `replyCardEnabled`
- `mixedInputAutoTranslateEnabled`
- `autoReadAloudEnabled`
- `preferredExpressionBiasEnabled`

### 7.3 Sidebar Context

`AppLayout` 额外维护：

- `sidebarCharacters`
- `selectedCharacterId`
- `refreshSidebarCharacters`
- `isSidebarOpen`
- `isOverlay`

## 8. 核心业务模块

### 8.1 Discover 流

`src/lib/discover-data.ts`

- `/v1/discover/config` 拉 Hero 角色 id
- `/v1/characters/market` 以 `limit=100` 分页拉全量角色
- 名称搜索在前端本地完成

`HeroCarousel`

- Embla 轮播
- 通过 `computeHeroTweenStyles` 计算每个 slide 的 `scale` 和 `opacity`

`CharacterCard`

- 玻璃卡片
- 标签最多显示 2 个
- 多余标签折叠成 `+N`

### 8.2 聊天流

`useChatSession`

- 拉取 snapshot
- 维护消息数组
- 管理 3 条流式链路：
  - 新消息
  - regen
  - user edit
- 管理分页加载旧消息
- 用 `snapshotContainsTurnIds` 防止旧响应覆盖当前路由状态

`ChatThread`

- 渲染消息列表
- 渲染学习卡浮层
- 管理回复卡、单词卡、更好表达的收藏切换
- 为浮层使用 `useFloatingPosition`

`ChatInput`

- `contenteditable` 输入区
- reply suggestions 回填
- 麦克风录音与转写
- 流式中断

`ChatHistorySidebar`

- 当前角色维度下的聊天历史分页
- 支持重命名和删除

`MessageNavigator`

- 根据滚动位置计算 rail 高亮
- 只基于用户消息建立导航项

### 8.3 学习辅助

当前学习辅助开关来自 `UserSettingsProvider`：

- `display_mode`
- `reply_card_enabled`
- `mixed_input_auto_translate_enabled`
- `preferred_expression_bias_enabled`

聊天页实际落地点：

- mixed-input transform
- reply suggestions
- `reply_card`
- `word_card`
- `feedback_card`
- favorites

### 8.4 角色管理

`CreateCharacterModal`

- 头像上传与裁剪
- 名称、描述、问候语、系统提示词
- 标签管理
- 可见性切换
- 模型选择
- 音色选择
- 对 clone 音色支持绑定角色管理

### 8.5 音色管理

`CreateVoiceCloneModal`

- 上传音频克隆音色
- 可上传头像
- 配置试听文本

`EditVoiceModal`

- 修改音色名称、描述、头像、试听文本
- 管理绑定角色

`VoiceSelector`

- 选择系统音色或用户克隆音色

`AudioPreviewButton`

- 播放现成 preview URL
- 或请求 `/v1/voices/{id}/preview/audio`

## 9. 支撑层

### 9.1 浮层与收藏辅助

- `useFloatingPosition`
  - 给 reply / word / feedback popover 计算固定定位
- `useDismissiblePopover`
  - 支持点击外部关闭与 `Esc`
- `useOptimisticFavorite`
  - 给 3 类卡片提供 optimistic 收藏切换

### 9.2 适配器

- `character-adapter`
  - `CharacterResponse -> Sidebar Character`
- `voice-adapter`
  - `VoiceSelectableItem / VoiceProfile -> 选择器 / 卡片显示模型`
- `llm-adapter`
  - 模型分组、本地搜索、provider 展示名
- `character-avatar`
  - 处理 `/uploads/*` 与默认头像

### 9.3 音频控制器

- `stt-recorder`
  - 麦克风录音与转写
- `tts-playback-manager`
  - 聊天页实时 TTS + 单条消息手动播放
- `audio-preview-manager`
  - 音色试听的全局互斥播放

## 10. 当前实现边界

- 本仓库没有数据库直连能力，所有业务数据都依赖后端 API。
- `story` 模式仍是占位页，没有独立剧情系统。
- `manageMemories`、`searchMemories`、`searchLLMModels` 等 API 方法虽然存在，但当前正式页面没有入口。
- 当前正式页面只有 5 个，不再包含调试路由或实验页。
- 当前前端收藏类型是 `reply_card / word_card / feedback_card`，不是旧文档里的 `sentence_card / knowledge_card`。

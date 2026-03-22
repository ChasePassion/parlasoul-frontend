# 发现页（Discover Page）重构方案 V1.7

> **文档位置**: `docs/plan/active/discover-page-refactor.md`
> **创建时间**: 2025-03-22
> **更新时间**: 2026-03-23
> **状态**: 后端基础与初始 Hero 配置已完成，前端待实施

---

## 更新日志

| 时间 | 版本 | 变更内容 |
|------|------|----------|
| 2025-03-22 | v1.0 | 初始版本 - 基础布局和组件设计 |
| 2025-03-22 | v1.1 | **重大更新**：巨幕轮播改为 Embla Carousel Cover Flow 效果，添加边缘露出、scale/opacity 动画 |
| 2025-03-22 | v1.2 | **重大更新**：角色卡片区域改为水平滚动分区设计（Netflix/Spotify 风格），添加 `HorizontalSection` 组件 |
| 2026-03-23 | v1.3 | **范围收敛**：当前版本只做角色发现页；剧情相关内容降级为未来占位；页面只保留一行“全部角色”；搜索方案固定为本地 `name` 搜索 |
| 2026-03-23 | v1.4 | **方案优化**：保留模式切换，剧情模式显示"正在开发中"占位页面；角色数据拉取全部（不限100个） |
| 2026-03-23 | v1.5 | **组件标准化**：全面采用 shadcn/ui 组件（Button、Card、Badge、Input、Avatar），更新所有代码示例，并补充 Discover 数据获取与搜索实现建议 |
| 2026-03-23 | v1.6 | **后端落地**：`market` 列表增加稳定排序；新增 `/v1/discover/config` 接口；新增文件型动态配置源 `config/discover.json`；Hero 配置改为 `hero_character_ids` |
| 2026-03-23 | v1.7 | **初始配置填充**：已将 `Elon Musk` 与 `Gork` 的真实角色 `id` 写入 `config/discover.json`，作为当前 Hero 初始配置 |
| 2026-03-23 | v1.8 | **方案简化**：删除 `CharacterCardItem` 组件计划，水平滚动区直接复用现有的 `CharacterCard` 组件 |
| 2026-03-23 | v1.9 | **设计优化**：`HorizontalSection` 组件简化 - 左侧移除渐变遮罩和按钮，右侧渐变遮罩集成低调箭头，箭头颜色弱化 |

---

## 0. 当前范围说明

- **当前实施范围**：角色发现页和剧情占位页。
- **角色模式**：处理角色数据的展示、搜索、进入聊天和整体视觉重构。
- **剧情模式**：显示"正在开发中"占位页面，不实现具体剧情功能。
- **角色数据**：拉取全部角色数据，不做数量限制。
- **后端基础状态**：Discover 所需后端基础已落地，包括稳定排序的 `market` 列表和独立的 Discover 配置接口。
- **Hero 初始配置状态**：`config/discover.json` 已填入当前 `Elon Musk` 和 `Gork` 的真实角色 `id`。
- **不做角色分类分区**：不做“热门 / 科幻 / 商业 / 历史”等固定分组，角色页面只保留一行“全部角色”水平滚动区。
- **“查看全部”是提示文案**：表达“可以继续右滑查看更多角色”，不绑定跳转。
- **搜索能力**：仅在角色模式下生效，本地 `name` 搜索，结果展示在输入框下方的下拉面板中。

---

## 1. 核心设计原则

| 原则 | 说明 |
|------|------|
| **消灭"管理后台感"** | 抛弃生硬的边框、冷灰色调和杂乱的信息堆砌 |
| **内容即界面** | 让角色内容和高质量图片成为页面主角；剧情相关视觉仅作为未来占位参考 |
| **沉浸式体验** | 通过巨幕轮播定调，下方直接平铺卡片 |

---

## 2. 全局布局架构

### 2.1 双列结构
沿用现有的 **"固定侧边栏 + 自适应主内容区"** 应用壳子，当前发现页只重构主内容区：

```
角色模式：
┌─────────────────────────────────────────────────────────────┐
│  ╭──────────╮                                               │
│  │ ✨ Logo  │                                               │
│  │          │   ╭──────────────────╮  ╭────────────────╮   │
│  │ 🧭 发现  │   │ 🔍 搜索角色...   │  │ [🎭剧情][🗣️角色]│   │
│  │ 💬 消息  │   ╰──────────────────╯  ╰────────────────╯   │
│  │          │  ╭──────────────────────────────────────────╮ │
│  │          │  │                                          │ │
│  │          │  │     🎬 巨幕轮播 (Hero Carousel)         │ │
│  │          │  │     Cover Flow 效果，边缘露出            │ │
│  │          │  │     16:9 高清图片，左右滑动              │ │
│  │          │  │                                          │ │
│  │          │  ╰──────────────────────────────────────────╯ │
│  │          │                                               │
│  │          │  ✨ 全部角色                    查看全部 →   │
│  │          │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ░░░░░░    │
│  │          │  │角色 │ │角色 │ │角色 │ │角色 │ ░截断░    │
│  │          │  └─────┘ └─────┘ └─────┘ └─────┘ ░░░░░░    │
│  ╰──────────╴───────────────────────────────────────────────╯

剧情模式：
┌─────────────────────────────────────────────────────────────┐
│  ╭──────────╮                                               │
│  │ ✨ Logo  │                                               │
│  │          │   ╭──────────────────╮  ╭────────────────╮   │
│  │ 🧭 发现  │   │ 🔍 剧情搜索敬请期待 │  │ [🎭剧情][🗣️角色]│   │
│  │ 💬 消息  │   ╰──────────────────╯  ╰────────────────╯   │
│  │          │                                               │
│  │          │         ┌─────────────────────┐               │
│  │          │         │                     │               │
│  │          │         │     🚧 正在开发中   │               │
│  │          │         │                     │               │
│  │          │         │   精彩剧情即将上线  │               │
│  │          │         │     敬请期待...     │               │
│  │          │         │                     │               │
│  │          │         └─────────────────────┘               │
│  ╰──────────╴───────────────────────────────────────────────╯
```

### 2.2 侧边栏 (Sidebar)

### 2.3 主内容区 (Main Content)

---

## 3. 模块详细设计

### 3.1 顶部控制台 (Top Console)

#### 布局定位
位于主内容区最上方：
- **左侧**: 搜索框
- **右侧**: 模式切换器（角色/剧情）

#### 3.1.1 全局搜索框 (Search Bar)
```
┌──────────────────────────────────┐
│ 🔍 │ 搜索角色...                │
└──────────────────────────────────┘
```

**样式规范**:
- 宽度: 320px (自适应缩小)
- 高度: 44px
- 圆角: 12px
- 背景: 白色带微妙边框 `border: 1px solid rgba(0,0,0,0.08)`
- 阴影: `0 2px 8px rgba(0,0,0,0.04)`
- 图标: 使用 `/search.svg`，颜色 `rgba(0,0,0,0.4)`
- 占位符文字: "搜索角色..."

**交互**:
- Focus 状态: 边框变为品牌色 `#924ff7`，添加 `box-shadow: 0 0 0 3px rgba(146,79,247,0.1)`

#### 3.1.2 模式切换器 (ModeSwitcher)

```
┌──────────────┬──────────────┐
│   🎭 剧情    │   🗣️ 角色   │
└──────────────┴──────────────┘
```

**样式规范**:
- 容器圆角: 10px
- 容器背景: `rgba(0,0,0,0.04)`
- 选中态: 白色背景 + 微妙阴影 `0 2px 6px rgba(0,0,0,0.08)`
- 未选中态: 透明背景，文字灰色
- 过渡动画: `transition: all 0.2s ease`

**功能**:
- 切换角色模式和剧情模式
- 角色模式: 显示 HeroCarousel + HorizontalSection
- 剧情模式: 显示 ComingSoonPage

#### 3.1.3 搜索能力说明

**方案定位**:
- 搜索交互参考浏览器地址栏 / 页内快速搜索：用户输入后，在输入框下方看到结果下拉框，再直接点击或回车进入目标角色。
- 搜索只是顶部的**快速直达入口**，不是用来重排 Discover 主内容区。
- 搜索只在**角色模式**下可用；剧情模式下搜索框禁用，仅保留占位文案。

**数据范围**:
- Discover 页通过分页请求拉取**全部** market characters，用于本地搜索和“全部角色”横向滚动区。
- 不再只依赖 sidebar 当前默认加载的角色列表。
- 搜索字段只匹配 `name`。

**匹配规则**:
- 输入内容先做 `trim()` 和小写化处理。
- 使用本地 `includes` 做名称包含匹配。
- 搜索结果保持角色原始顺序，不做热度排序或相关性排序。

**结果展示**:
- 搜索结果显示在输入框下方的下拉面板中。
- 每项展示：头像 + 角色名称。
- 下拉面板最多展示 `6-8` 条结果。
- 无结果时显示：`未找到对应角色`。

**交互规则**:
- 输入框聚焦且有输入内容时打开下拉框。
- 点击结果项后直接进入对应角色聊天。
- 点击输入框外部区域时关闭下拉框。
- `Esc` 关闭下拉框。
- `↑ / ↓` 切换高亮项，`Enter` 进入当前高亮项。
- 默认不实时重排 Hero，也不实时过滤“全部角色”横向滚动区。

---

### 3.2 巨幕轮播区 (Hero Carousel)

这是整个页面的"情绪放大器"，当前用于展示推荐角色。**采用 Cover Flow 效果：当前卡片居中放大显示，左右边缘露出下一张/上一张，滑动时当前卡片变小变淡退出，新卡片变大变实进入**。未来如果要接剧情内容，可以沿用同一套轮播结构，但当前版本不实现剧情轮播逻辑。

#### 3.2.1 技术选型：Embla Carousel

**选择理由**:
- ✅ **包体积极小**: ~5kb（vs Swiper ~35kb）
- ✅ **shadcn/ui 官方使用**: 与项目现有 UI 体系一致
- ✅ **完全可控**: Tailwind CSS 自定义样式，无样式冲突
- ✅ **原生流畅感**: iOS 物理引擎手感
- ✅ **完美支持 Cover Flow**: 通过 scroll 事件实时计算 scale 和 opacity

**对比其他方案**:

| 方案 | 包体积 | Cover Flow | 自由度 | 推荐度 |
|------|--------|------------|--------|--------|
| Swiper.js | ~35kb | ✅ 内置 | 中 | ⭐⭐⭐ |
| Embla | **~5kb** | ⚠️ 需实现 | **高** | **⭐⭐⭐⭐⭐** |
| Framer Motion | ~30kb | ⚠️ 需实现 | 高 | ⭐⭐⭐⭐ |

#### 3.2.2 物理结构与视觉效果

```
初始状态:
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│ ┌─────────┐ ┌───────────────────────────────┐ ┌─────────┐  │
│ │ scale   │ │                               │ │ scale   │  │
│ │ 0.85    │ │    scale(1.0) opacity(1.0)    │ │ 0.85    │  │
│ │ opacity │ │                               │ │ opacity │  │
│ │ 0.5     │ │    [16:9 伊隆·马斯克图片]      │ │ 0.5     │  │
│ │         │ │                               │ │         │  │
│ │ [上一张]│ │    [当前显示 - 可交互]         │ │ [下一张]│  │
│ │ 边缘露出│ │                               │ │ 边缘露出│  │
│ └─────────┘ └───────────────────────────────┘ └─────────┘  │
│                                                             │
│        ◀                                    ▶              │
└─────────────────────────────────────────────────────────────┘

向左滑动时 (向左滑的动画):
    ← ← ← 滑动方向 ← ← ←

 ┌─────────┐  ┌───────────────────┐  ┌───────────────────┐
 │         │  │                   │  │                   │
 │ 0.85    │← │ scale↓ opacity↓   │→ │ scale↑ opacity↑   │
 │ 左边缘  │  │ 当前卡片离开      │  │ 新卡片进入        │
 │         │  │                   │  │                   │
 │         │  │ 变小变淡消失      │  │ 变大变实清晰      │
 └─────────┘  └───────────────────┘  └───────────────────┘
```

**尺寸规范**:
- 宽度: 100%
- **卡片宽度**: 85%（露出左右边缘约 7.5%）
- **宽高比**: 16:9（卡片内部图片）
- 最大高度: 480px
- 圆角: 20px
- 外边距: 与搜索区保持 32px 间距

**悬浮效果**:
```css
box-shadow: 0 20px 40px rgba(0,0,0,0.1);
```

#### 3.2.3 Cover Flow 动画参数

| 属性 | 当前卡片 (中心) | 边缘卡片 (两侧) | 动画曲线 |
|------|----------------|----------------|----------|
| **scale** | 1.0 | 0.85 | 线性插值 |
| **opacity** | 1.0 | 0.5 | 线性插值 |
| **z-index** | 10 | 1 | 固定层级 |
| **transition** | - | 100ms ease-out | 实时跟随滚动 |

**核心动画逻辑**:
```typescript
// 根据滚动位置计算每张卡片的 scale 和 opacity
const tweenScale = (api: EmblaCarouselType) => {
  const scrollProgress = api.scrollProgress();
  const tweenValue = 1 - Math.abs(diffToTarget * TWEEN_FACTOR);

  // scale: 中心 1.0，边缘 0.85
  const scale = Math.max(0.85, tweenValue);

  // opacity: 中心 1.0，边缘 0.5
  const opacity = Math.max(0.5, tweenValue);

  slideNode.style.transform = `scale(${scale})`;
  slideNode.style.opacity = String(opacity);
};
```

#### 3.2.4 图片展示与内容叠加

**图片处理**:
- 所有轮播图统一为 16:9 比例
- 使用 `object-fit: cover` 确保图片填满容器
- 图片中心对齐 `object-position: center`

**底部渐变遮罩 + CTA按钮**:
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                      [16:9 图片]                            │
│                                                             │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  ░░                                                    ░░  │
│  ░░              [开始对话 →]                           ░░  │
│  ░░                                                    ░░  │
└─────────────────────────────────────────────────────────────┘
```

**渐变遮罩 CSS**:
```css
.hero-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 50%;
  background: linear-gradient(
    to top,
    rgba(0,0,0,0.8) 0%,
    rgba(0,0,0,0.4) 50%,
    rgba(0,0,0,0) 100%
  );
}
```

**CTA按钮**:
- 位置: 底部居中
- 样式: 白色背景 + 深色文字
- 圆角: 8px
- 内边距: `padding: 10px 24px`
- Hover: 背景变为 `rgba(255,255,255,0.9)`，轻微放大 `scale(1.05)`

#### 3.2.5 左右切换交互
- **位置**: 横幅左右两侧垂直居中
- **样式**: 圆形按钮，40px 直径
- **颜色**: 白色背景 `rgba(255,255,255,0.9)` + 深色箭头
- **阴影**: `0 2px 8px rgba(0,0,0,0.2)`
- **Hover**: 背景变为纯白色，轻微放大 `scale(1.05)`

**手势支持**:
- 支持鼠标拖拽滑动
- 支持触摸屏滑动
- 支持点击左右按钮切换

**数据**: 初期使用静态角色数据，2-3 张轮播图
- 当前角色数据: Elon.png, Gork.png
- **Hero 选取规则**: 前端通过 `/v1/discover/config` 返回的 `hero_character_ids` 选取 Hero，不依赖前端硬编码白名单
- **Hero 配置字段**: `hero_character_ids: string[]`，值为角色 `id`
- **V1 配置来源**: 后端文件型配置 `config/discover.json`
- **当前已配置角色**: `Elon Musk`、`Gork`
- 未来剧情占位: 如果后续需要剧情封面，可复用当前结构，但本期不接剧情接口、不新增剧情模式、不新增剧情路由

**点击行为**: 点击进入对应的角色对话界面

---

### 3.3 剧情占位页 (Coming Soon)

当用户切换到剧情模式时，显示"正在开发中"占位页面。

#### 3.3.1 页面设计

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                          🚧                                 │
│                                                             │
│                      正在开发中                             │
│                                                             │
│                  精彩剧情即将上线                           │
│                      敬请期待...                            │
│                                                             │
│                     上线时间待定                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**样式规范**:
- 图标: 🚧 或自定义施工图标，size: 64px
- 标题: `font-size: 24px`, `font-weight: 700`, `color: #0d0d0d`
- 描述: `font-size: 16px`, `color: #5d5d5d`
- 布局: 垂直居中，最小高度 60vh

**交互**: 无交互，纯展示。

---

### 3.4 全部角色横向滚动区 (All Characters Shelf)

用户真正消费和挑选内容的区域。当前版本只保留 **一行“全部角色”横向滚动区**，不做多分区，不写死角色分类。

#### 3.4.0 数据规则

- **排序规则**: 直接沿用当前 `market` 接口返回顺序，前端不做二次排序。后端已固定为 `created_at ASC, id ASC`。
- **数据范围**: 拉取全部角色数据，不做数量限制。
- **展示规则**: 全部角色放进同一条横向滚动区里。
- **超出首屏的处理**: 通过用户右滑查看后续卡片，不做分页提示，不做“加载更多”交互。

#### 3.4.1 为什么选择水平滚动？

**传统网格的问题**:
- ❌ 卡片平铺占用大量垂直空间
- ❌ 角色多了页面无限拉长
- ❌ 与上方 Hero 的视觉节奏断裂

**当前单行横滑的优势**:
- ✅ 保留沉浸感，不把页面做成角色目录表
- ✅ 节省垂直空间，Hero 下方能快速承接角色选择
- ✅ 不依赖分类体系，适合当前“全部角色”范围
- ✅ 用户能通过右侧截断自然理解“还有更多”

#### 3.4.2 分区结构

```
┌─────────────────────────────────────────────────────────────┐
│  ✨ 全部角色                                   查看全部 →   │
│                                                             │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ░░░░░░░      │
│  │        │ │        │ │        │ │        │ ░ 截断 ░      │
│  │  伊隆  │ │  Gork  │ │  角色C │ │  角色D │ ░░░░░░░      │
│  │        │ │        │ │        │ │        │               │
│  └────────┘ └────────┘ └────────┘ └────────┘               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 3.4.3 用户提示设计

**问题**: 用户如何知道这个区域可以滑动？

**解决方案 - 多层提示策略**:

| 层级 | 实现方式 | 效果 |
|------|----------|------|
| **视觉暗示** | 右侧卡片截断 + 渐变淡出 | 用户自然看到"还有更多" |
| **显式提示** | "查看全部" 提示文案 | 明确告知可继续右滑查看更多，不承担跳转职责 |
| **交互暗示** | 右侧渐变遮罩集成低调箭头 | 可点击滚动，颜色不突兀 |
| **动效引导** | 首次进入微滚动动画 | 移动端直观 |

**右侧渐变淡出效果**:
```css
.scroll-container::after {
  content: '';
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 60px;
  background: linear-gradient(to left, white, transparent);
  pointer-events: none;
}
```

#### 3.4.4 卡片设计

**卡片规格**:
- 宽度: 200px (flex: 0 0 200px)
- 比例: 3:4 (竖版头像更适合角色展示)
- 圆角: 12px
- 阴影: 悬停时加深

**卡片内容**:
```
┌────────────────┐
│                │
│     [头像]     │
│                │
│  ░░░░░░░░░░░░  │
│  ░ 角色名称   ░  │
│  ░ 描述      ░  │
│  ░ [标签]    ░  │
│  ░░░░░░░░░░░░  │
└────────────────┘
```

**数据结构**:
```typescript
interface Character {
  id: string;
  name: string;
  description: string;
  avatar: string;
  tags?: string[];
}
```

---

## 4. 交互状态流转

### 4.1 页面主流程

```
页面进入发现页
           │
           ▼
    ┌──────────────┐
    │ 1. 拉取 Discover 配置 │
    │ /v1/discover/config  │
    └──────────────┘
           │
           ▼
    ┌──────────────┐
    │ 2. 拉取角色数据 │
    │ market characters │
    └──────────────┘
           │
           ▼
    ┌──────────────┐
    │ 3. 生成 Hero   │
    │ 按 hero_character_ids │
    └──────────────┘
           │
           ▼
    ┌──────────────┐
    │ 4. 渲染横滑区  │
    │ 标题 = 全部角色 │
    └──────────────┘
           │
           ▼
    ┌──────────────┐
    │ 5. 用户横向浏览 │
    │ 点击角色进聊天 │
    └──────────────┘
```

**搜索补充说明**:
- 搜索只作为顶部下拉直达入口
- 默认不实时重排 Hero，也不实时过滤“全部角色”横向滚动区

### 4.2 巨幕轮播交互 (Embla Cover Flow)

```
用户滑动/点击 ◀ or ▶
           │
           ▼
    ┌──────────────────────────────┐
    │ Embla scroll 事件触发         │
    │ 实时计算每张卡片的偏移量        │
    │ scrollProgress: 0.0 ~ 1.0     │
    └──────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────┐
    │ 计算每张卡片与中心的距离        │
    │ diffToTarget = target - progress│
    │ tweenValue = 1 - |diff| * factor│
    └──────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────┐
    │ 应用 scale 和 opacity         │
    │ scale = max(0.85, tweenValue) │
    │ opacity = max(0.5, tweenValue)│
    │ 实时更新 DOM                   │
    └──────────────────────────────┘
```

**核心实现逻辑**:
```typescript
// 1. 初始化 Embla
const [emblaRef, emblaApi] = useEmblaCarousel({
  loop: true,           // 无限循环
  align: 'center',      // 居中对齐
  skipSnaps: false      // 必须滑到指定位置
});

// 2. 动画因子（调整这个值改变动画强度）
const TWEEN_FACTOR = 0.52;

// 3. 核心动画函数 - 绑定到 scroll 事件
const tweenScale = useCallback((api: EmblaCarouselType) => {
  const engine = api.internalEngine();
  const scrollProgress = api.scrollProgress();
  const slidesInView = api.slidesInView();

  api.scrollSnapList().forEach((scrollSnap, snapIndex) => {
    let diffToTarget = scrollSnap - scrollProgress;
    const slidesInSnap = engine.indexGroups[snapIndex];

    slidesInSnap.forEach((slideIndex) => {
      // 只计算可视区域内的卡片，优化性能
      if (!slidesInView.includes(slideIndex)) return;

      // 处理 loop 循环时的边界计算
      if (engine.options.loop) {
        engine.slideLooper.loopPoints.forEach((loopPoint) => {
          const target = loopPoint.target();
          if (slideIndex === loopPoint.index && target !== 0) {
            const sign = Math.sign(target);
            if (sign === -1) diffToTarget = scrollSnap - (1 + scrollProgress);
            if (sign === 1) diffToTarget = scrollSnap + (1 - scrollProgress);
          }
        });
      }

      // 计算动画值：距离中心越远，越小越淡
      const tweenValue = 1 - Math.abs(diffToTarget * TWEEN_FACTOR);
      const scale = Math.max(0.85, Number(tweenValue.toFixed(3)));
      const opacity = Math.max(0.5, Number(tweenValue.toFixed(3)));

      // 应用到 DOM
      const slideNode = tweenNodes.current[slideIndex];
      if (slideNode) {
        slideNode.style.transform = `scale(${scale})`;
        slideNode.style.opacity = String(opacity);
      }
    });
  });
}, []);

// 4. 绑定事件
useEffect(() => {
  if (!emblaApi) return;
  setTweenNodes(emblaApi);
  tweenScale(emblaApi);

  emblaApi
    .on('reInit', setTweenNodes)
    .on('reInit', tweenScale)
    .on('scroll', tweenScale)      // 滚动时实时更新
    .on('slideFocus', tweenScale); // 焦点变化时更新
}, [emblaApi]);
```

**边界处理**:
- Embla `loop: true` 自动处理无限循环
- 到第一张时点击左箭头 → 平滑循环到最后一张
- 到最后一张时点击右箭头 → 平滑循环到第一张

**性能优化**:
- `slidesInView` 检查：只计算可视区域内的卡片
- `will-change: transform, opacity`：启用 GPU 加速
- 100ms transition：平滑但不拖沓

---

## 5. 技术实现要点

### 5.1 组件拆分

```
DiscoverPage (page.tsx)
├── TopConsole
│   ├── SearchBar            ← 搜索框
│   ├── SearchDropdown       ← 搜索结果下拉面板
│   └── ModeSwitcher         ← 模式切换（角色/剧情）
├── ContentArea              ← 内容区域（根据模式切换）
│   ├── Mode: character
│   │   ├── HeroCarousel     ← Embla Cover Flow 轮播
│   │   └── HorizontalSection ← “全部角色”横向滚动区
│   └── Mode: story
│       └── ComingSoonPage   ← “正在开发中”占位页
├── HeroCarousel
│   ├── EmblaViewport        ← overflow-hidden 容器
│   ├── EmblaContainer       ← flex 轨道
│   ├── CarouselSlide        ← 单张 16:9 卡片
│   │   ├── Image            ← 背景图片
│   │   ├── GradientOverlay  ← 底部渐变遮罩
│   │   └── CTAButton        ← CTA按钮（开始对话）
│   ├── NavButton            ← 左右切换按钮
│   └── PlaceholderSlide     ← 占位卡片
├── HorizontalSection
│   ├── SectionHeader        ← 标题 + “查看全部”提示
│   ├── ScrollContainer      ← 滚动容器
│   │   ├── FadeOverlay      ← 渐变遮罩（右侧集成箭头）
│   │   └── ScrollRow        ← 水平滚动行
│   └── CharacterCard        ← 角色卡片（复用现有组件）
└── ComingSoonPage           ← 剧情占位页
    ├── Icon                 ← 施工图标
    ├── Title                ← 标题
    ├── Description          ← 描述文本
    └── Footer               ← 占位说明文案
```

### 5.2 依赖安装

#### 5.2.1 第三方库

```bash
# 安装 Embla Carousel
npm install embla-carousel-react

# 或使用 pnpm
pnpm add embla-carousel-react
```

#### 5.2.2 shadcn/ui 组件

本项目已使用 shadcn/ui，以下组件将被使用（请确认已安装）：

```bash
# 已安装组件（若缺失请添加）
npx shadcn@latest add button input avatar badge card
```

**各组件用途说明**：

| 组件 | 用途 | 安装命令 |
|------|------|----------|
| `Button` | CTA按钮、箭头按钮、搜索按钮 | `npx shadcn@latest add button` |
| `Input` | 搜索框输入 | `npx shadcn@latest add input` |
| `Avatar` | 角色头像（搜索下拉、卡片） | `npx shadcn@latest add avatar` |
| `Badge` | 角色标签 | `npx shadcn@latest add badge` |
| `Card` | 角色卡片容器 | `npx shadcn@latest add card` |

**使用原则**：
- ✅ 优先使用 shadcn 组件，保持 UI 一致性
- ✅ 使用 shadcn 的 `variant` 和 `size` 预设
- ✅ 使用语义化颜色（如 `bg-primary`、`text-muted-foreground`）
- ❌ 避免直接覆盖组件颜色和排版样式
- ❌ 避免使用原始色值（如 `bg-blue-500`）

### 5.2.3 实现建议：Discover 数据获取与搜索

为了降低落地复杂度，建议 Discover 页**不要继续复用 sidebarCharacters 作为主数据源**，而是自己维护一份 Discover 专用数据。原因：

- Sidebar 当前只拉默认分页的一批角色，不适合作为“拉全量 + 本地搜索”的数据基础。
- Hero 数据来自独立的 discover config 接口，当前 Sidebar 数据不包含这层运行时配置。
- 搜索结果下拉框和“全部角色”横滑区应该共享同一份 Discover 数据，避免一处能搜到、一处看不到。

#### 建议的数据拉取 helper

```typescript
// src/lib/discover-data.ts
import { getMarketCharacters, type CharacterResponse } from '@/lib/api';

const DISCOVER_PAGE_SIZE = 100;

export async function fetchAllMarketCharacters(): Promise<CharacterResponse[]> {
  const all: CharacterResponse[] = [];
  let skip = 0;

  while (true) {
    const batch = await getMarketCharacters(skip, DISCOVER_PAGE_SIZE);
    all.push(...batch);

    if (batch.length < DISCOVER_PAGE_SIZE) {
      break;
    }

    skip += batch.length;
  }

  return all;
}
```

#### Discover 配置 helper

```typescript
// src/lib/discover-data.ts
export interface DiscoverConfig {
  hero_character_ids: string[];
}

export async function getDiscoverConfig(): Promise<DiscoverConfig> {
  const response = await fetch('/v1/discover/config');
  const payload = await response.json();
  return payload.data as DiscoverConfig;
}
```

#### Hero 角色选取 helper

```typescript
export function selectHeroCharacters(
  characters: CharacterResponse[],
  heroCharacterIds: string[]
) {
  return heroCharacterIds
    .map((id) => characters.find((character) => character.id === id))
    .filter((character): character is CharacterResponse => Boolean(character));
}
```

#### 本地 name 搜索 helper

```typescript
export function filterCharactersByName(
  characters: CharacterResponse[],
  query: string
): CharacterResponse[] {
  const normalized = query.trim().toLocaleLowerCase();

  if (!normalized) return [];

  return characters.filter((character) =>
    character.name.toLocaleLowerCase().includes(normalized)
  );
}
```


#### Discover 页状态建议

```typescript
const [mode, setMode] = useState<ViewMode>('character');
const [discoverCharacters, setDiscoverCharacters] = useState<CharacterResponse[]>([]);
const [discoverConfig, setDiscoverConfig] = useState<DiscoverConfig>({ hero_character_ids: [] });
const [searchQuery, setSearchQuery] = useState('');
const [activeResultIndex, setActiveResultIndex] = useState(0);

const searchResults = useMemo(
  () => filterCharactersByName(discoverCharacters, searchQuery).slice(0, 8),
  [discoverCharacters, searchQuery]
);

const heroCharacters = useMemo(
  () => selectHeroCharacters(discoverCharacters, discoverConfig.hero_character_ids),
  [discoverCharacters, discoverConfig.hero_character_ids]
);
```

**落地建议**:
- `SearchDropdown` 用 `onMouseDown` 阻止输入框先 `blur`，否则点击结果时下拉框会先消失。
- 搜索只在角色模式启用，切到剧情模式时直接清空 `searchQuery` 并关闭下拉框。
- Hero 和“全部角色”横滑区都应基于同一份 `discoverCharacters` 数据。
- Discover 页初始化时先并行获取 Discover 配置和角色列表，再计算 Hero。

#### 5.5.2 角色卡片复用说明

**重要：水平滚动区直接复用现有的 `CharacterCard` 组件，无需创建新的 3:4 竖版卡片。**

现有的 `CharacterCard` 组件（位于 `src/components/CharacterCard.tsx`）已经实现了：
- ✅ 玻璃拟态设计风格（四层结构）
- ✅ 悬停动效（背景模糊变化、scale 放大）
- ✅ 标签展示（含溢出处理）
- ✅ 菜单功能（编辑/删除）
- ✅ 点击跳转聊天


### 5.6 状态管理

```typescript
type ViewMode = 'character' | 'story';

interface DiscoverState {
  mode: ViewMode;                    // 当前模式：角色/剧情
  characters: Character[];           // 全部角色数据
  searchQuery: string;               // 搜索关键词
  searchResults: Character[];        // 搜索结果
  isSearchOpen: boolean;             // 搜索下拉框是否打开
  activeResultIndex: number;         // 当前高亮的搜索结果索引
}

// Discover 运行时配置
interface DiscoverConfig {
  hero_character_ids: string[];
}
```

#### 性能优化策略

1. **节流处理**: 使用 `requestAnimationFrame` 避免频繁计算
2. **Passive 事件**: `{ passive: true }` 不阻塞主线程
3. **GPU 加速**: `will-change: transform` 启用硬件加速
4. **懒加载**: 图片使用 `loading="lazy"`

#### 浏览器兼容性

| 特性 | Chrome | Safari | Firefox | Edge |
|------|--------|--------|---------|------|
| `scroll-snap` | ✅ 86+ | ✅ 14+ | ✅ 68+ | ✅ 86+ |
| `scroll-behavior` | ✅ 61+ | ✅ 14+ | ✅ 36+ | ✅ 79+ |
| `gap` (flex) | ✅ 84+ | ✅ 14.1+ | ✅ 63+ | ✅ 84+ |

**覆盖率**: > 95% 的现代浏览器

### 5.9 响应式适配

| 断点 | 巨幕尺寸 | 卡片宽度 | 搜索框宽度 |
|------|----------|----------|------------|
| Desktop (>1024px) | 16:9, max-h 480px | 200px | 360px |
| Tablet (768-1024px) | 16:9, max-h 360px | 180px | 280px |
| Mobile (<768px) | 16:9, 全宽 | 160px | 100% |

---

## 6. shadcn/ui 组件使用总结

### 6.1 已安装组件

```bash
# 全部已安装，无需重复添加
npx shadcn@latest add button card badge input avatar
```

### 6.2 组件使用对照表

| 自定义组件 | 使用 shadcn 组件 | 说明 |
|------------|------------------|------|
| `HeroCarousel` CTA按钮 | `Button` | `variant="default"`, `size="lg"` |
| `HorizontalSection` 箭头 | 原生按钮元素 | 集成在渐变遮罩内，不使用 shadcn Button |
| `CharacterCard` 卡片 | `Card` + `CardContent` | 复用现有组件，玻璃拟态效果 |
| 搜索框 | `Input` | 待实现 |
| 角色头像 | `Avatar` | 待实现 |

### 6.3 shadcn 使用规范

**✅ 推荐做法**:
- 使用组件预设 `variant` 和 `size`
- 使用语义化颜色类名（如 `bg-primary`, `text-muted-foreground`）
- 使用 `cn()` 工具函数合并类名
- 图标使用 `data-icon` 属性

**❌ 避免做法**:
- 直接覆盖组件核心样式
- 使用原始色值（如 `bg-blue-500`）
- 无必要时手动堆叠过多 `z-index`（局部 overlay / dropdown / 浮动按钮除外）
- 使用 `space-x-*` 或 `space-y-*`

---

## 7. 图片资源清单

| 文件名 | 用途 | 位置 | 规格 |
|--------|------|------|------|
| Elon.png | 巨幕轮播 - 角色1 | /public/Elon.png | 16:9 比例，高清 |
| Gork.png | 巨幕轮播 - 角色2 | /public/Gork.png | 16:9 比例，高清 |
| search.svg | 搜索框图标 | /public/search.svg | SVG |

**图片规格要求**:
- 所有巨幕轮播图必须是 **16:9 比例**
- 建议分辨率: 1920×1080 或更高
- 格式: PNG 或 JPG

**占位符处理**:
- 剧情图片如未来接入，可使用纯色渐变或占位图；当前版本不实现剧情入口
- 第三个角色使用默认占位图
- 所有占位图也保持 16:9 比例

---

## 8. 待办事项

### 已完成：后端基础（2026-03-23）
- [x] `market` 列表增加稳定排序：`created_at ASC, id ASC`
- [x] 新增 `/v1/discover/config` 接口
- [x] 新增文件型动态配置源：`config/discover.json`
- [x] 已写入初始 Hero 配置：Elon Musk、Gork
- [x] 新增后端测试：discover config 接口、配置读取、market 排序

### 阶段一：依赖与基础
- [ ] 安装 Embla Carousel: `pnpm add embla-carousel-react`
- [ ] 检查 shadcn 组件安装: `npx shadcn@latest add button card badge input avatar`
- [ ] 创建 `HeroCarousel` 组件（使用 shadcn Button）
- [ ] 测试轮播基础功能（滑动、按钮切换、循环）
- [ ] 调整动画参数（TWEEN_FACTOR、scale、opacity）

### 阶段二：功能组件
- [ ] 创建 `TopConsole` 组件
  - [ ] `SearchBar` 搜索框 UI
  - [ ] `SearchDropdown` 搜索结果下拉面板
  - [ ] `ModeSwitcher` 模式切换器（角色/剧情）
  - [ ] 实现本地 `name` 搜索
  - [ ] 支持 `↑ / ↓ / Enter / Esc` 键盘交互
- [ ] 创建 `ComingSoonPage` 组件（剧情占位页）
- [ ] 创建水平滚动分区组件
  - [ ] `HorizontalSection` - 右侧渐变遮罩集成低调箭头（可点击滚动）
  - [ ] 复用现有的 `CharacterCard` 组件展示角色
  - [ ] 左侧不需要渐变遮罩和按钮
  - [ ] 实现仅检测右侧的滚动边界
- [ ] 添加 placeholder 占位图组件

### 阶段三：页面整合
- [ ] 更新 `DiscoverPage` 整合所有组件
  - [ ] 拉取全部角色数据
  - [ ] 拉取 `/v1/discover/config`
  - [ ] 实现模式切换逻辑（角色模式/剧情模式）
  - [ ] 角色模式：整合 `HeroCarousel` + `HorizontalSection`
  - [ ] 剧情模式：显示 `ComingSoonPage`
  - [ ] 根据 `hero_character_ids` 生成 Hero 列表
- [ ] 添加响应式适配
  - [ ] Desktop (>1024px): 卡片 200px 宽度
  - [ ] Tablet (768-1024px): 卡片 180px 宽度
  - [ ] Mobile (<768px): 卡片 160px 宽度
- [ ] 添加 CSS `scrollbar-hide` 配置

### 阶段四：优化与测试
- [ ] 性能优化（图片懒加载、will-change）
- [ ] 触摸手势测试（移动端滑动）
- [ ] 模式切换测试（角色/剧情）
- [ ] 校验“查看全部”文案在所有端上都被理解为“继续右滑”
- [ ] 校验搜索结果下拉框不会影响 Hero 和横向滚动区布局
- [ ] 校验搜索空态文案：`未找到对应角色`
- [ ] 完整交互流程测试

---

## 9. 附录：视觉参考

### 9.1 颜色系统

| 用途 | 色值 | 说明 |
|------|------|------|
| 主背景 | `#ffffff` | 纯白 |
| 侧边栏背景 | `#f2f2f2` | 浅灰 |
| 主文字 | `#0d0d0d` | 近黑 |
| 次要文字 | `#5d5d5d` | 中灰 |
| 品牌色 | `#924ff7` | 紫色 |

### 9.2 阴影系统

| 用途 | 阴影值 |
|------|--------|
| 巨幕 | `0 24px 48px rgba(0,0,0,0.08)` |
| 卡片悬停 | `0 20px 40px rgba(0,0,0,0.12)` |
| 搜索框 | `0 2px 8px rgba(0,0,0,0.04)` |
| 选中态 | `0 2px 6px rgba(0,0,0,0.08)` |

### 9.3 水平滚动区渐变遮罩设计

**右侧渐变遮罩 + 低调箭头**：

```
卡片区域          渐变遮罩(64px)        箭头
├──────────────┤░░░░░░░░░░░░░░░░░░░░░▶│
               ↑                      ↑
            渐变开始              半透明箭头
   from-white/90 via-white/60 to-transparent
```

**实现要点**：
- 渐变遮罩宽度：`64px`（`w-16`）
- 渐变方向：`bg-gradient-to-l`（从右向左）
- 渐变层次：`from-white/90 via-white/60 to-transparent`
- 箭头容器：`w-8 h-8`，背景 `bg-black/5`，悬浮 `bg-black/10`
- 箭头颜色：`text-gray-400/60`，悬浮 `text-gray-500/80`
- 箭头线宽：`strokeWidth={1.5}`（细线风格）
- 点击区域：整个渐变遮罩可点击（不只是箭头）

**交互反馈**：
- 悬浮时渐变加深：`group-hover:from-white group-hover:via-white/80`
- 箭头容器背景加深：`group-hover:bg-black/10`
- 箭头颜色加深：`group-hover:text-gray-500/80`

---

## 10. 附录：Embla Cover Flow 技术详解

### 9.1 核心原理

Cover Flow 效果通过实时计算每张卡片与视口中心的距离，动态调整其 `scale` 和 `opacity`：

```
距离中心越远 → scale 越小 → opacity 越低
距离中心越近 → scale 越大 → opacity 越高
```

**数学公式**:
```
tweenValue = 1 - |scrollSnap - scrollProgress| * TWEEN_FACTOR
scale = max(MIN_SCALE, tweenValue)
opacity = max(MIN_OPACITY, tweenValue)
```

### 9.2 参数调优指南

| 参数 | 默认值 | 范围 | 效果 |
|------|--------|------|------|
| `TWEEN_FACTOR` | 0.52 | 0.3 - 0.8 | 动画响应速度。越大动画越"灵敏"，越小越"平滑" |
| `MIN_SCALE` | 0.85 | 0.7 - 0.95 | 边缘卡片最小缩放。越小透视感越强，越大越扁平 |
| `MIN_OPACITY` | 0.5 | 0.3 - 0.7 | 边缘卡片最小透明度。越低边缘越淡，越高越清晰 |
| `flex-[0_0_X%]` | 85% | 70% - 90% | 卡片宽度。越小露出的边缘越多，越大越接近单张 |

**推荐配置组合**:

| 风格 | TWEEN_FACTOR | MIN_SCALE | MIN_OPACITY | 卡片宽度 |
|------|--------------|-----------|-------------|----------|
**立体透视** | 0.6 | 0.75 | 0.4 | 80% |
| **柔和渐变** | 0.45 | 0.88 | 0.6 | 85% |
| **明显堆叠** | 0.7 | 0.7 | 0.35 | 75% |

### 9.3 性能优化要点

1. **will-change**: 启用 GPU 加速
   ```css
   .carousel-slide {
     will-change: transform, opacity;
   }
   ```

2. **slidesInView 检查**: 只计算可视区域内的卡片
   ```typescript
   if (!slidesInView.includes(slideIndex)) return;
   ```

3. **transition 时长**: 100ms 是实时跟随滚动的最佳平衡点
   ```css
   transition: transform 0.1s ease-out, opacity 0.1s ease-out;
   ```

4. **图片优化**: 使用 Next.js Image 组件自动优化
   ```typescript
   <Image fill className="object-cover" priority />
   ```

### 9.4 常见问题

**Q: 动画卡顿怎么办？**
- 减少 `TWEEN_FACTOR`，降低计算频率
- 检查是否有过多的重绘（打开 Chrome DevTools Performance 面板）
- 确保图片已压缩优化

**Q: 边缘卡片露出的太少/太多？**
- 调整 CSS `flex-[0_0_X%]`，数值越小露出越多
- 移动端建议用 90%，桌面端 85%

**Q: 如何添加自动轮播？**
```typescript
import Autoplay from 'embla-carousel-autoplay';

const [emblaRef] = useEmblaCarousel(
  { loop: true },
  [Autoplay({ delay: 4000, stopOnInteraction: true })]
);
```

---

## 11. 附录：水平滚动分区技术详解

### 10.1 为什么选择纯 CSS + React 而非第三方库？

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **纯 CSS + React** | 零依赖、完全可控、性能好 | 需手动实现边界检测 | **本项目推荐** |
| Swiper | 功能丰富、文档完善 | 包体积大(~35kb)、样式难覆盖 | 复杂轮播需求 |
| Embla | 轻量(~5kb)、灵活 | 本场景过于复杂 | 需要复杂动画时 |

### 10.2 Scroll Snap 深度解析

**工作原理**:
```
用户滚动 → 滚动惯性停止 → 浏览器计算最近吸附点 → 自动对齐
```

**关键属性**:

| 属性 | 值 | 作用 |
|------|-----|------|
| `scroll-snap-type` | `x mandatory` | 强制水平吸附 |
| `scroll-snap-align` | `start` | 卡片左边缘对齐容器左边缘 |
| `scroll-padding` | `0` | 吸附偏移量 |

**mandatory vs proximity**:
- `mandatory`: 强制吸附，用户无法停在卡片之间
- `proximity`: 仅在接近吸附点时吸附，更自然

**本项目选择**: `mandatory`，确保每次滚动都停在完整卡片上。

### 10.3 滚动性能优化深度

**1. 节流策略对比**

| 策略 | 实现 | 频率 | 适用场景 |
|------|------|------|----------|
| 直接监听 | `onScroll={handler}` | 每帧触发 | ❌ 性能差 |
| setTimeout节流 | `setTimeout(handler, 16)` | ~60fps | ⚠️ 一般 |
| **requestAnimationFrame** | `rAF(() => handler)` | 与屏幕刷新同步 | ✅ **推荐** |
| 被动事件 | `{ passive: true }` | 不阻塞主线程 | ✅ **必须** |

**2. 重绘优化**

```css
/* 避免触发重排 */
.scroll-row {
  will-change: transform;  /* 提前告知浏览器 */
  contain: layout;          /* 隔离布局计算 */
}
```

### 10.4 用户体验细节

**1. 滚动距离计算**

```typescript
// 滚动 3 张卡片的宽度
const CARD_WIDTH = 200;
const GAP = 16;
const scrollAmount = (CARD_WIDTH + GAP) * 3; // 648px
```

**2. 右侧渐变遮罩显示逻辑**

```
初始状态 → canScrollRight = true
            ↓
      显示右侧渐变遮罩（含箭头）
            ↓
      用户滚动到最右侧
            ↓
      canScrollRight = false
            ↓
      渐变遮罩淡出隐藏
```

**设计选择**：
- ❌ 不在左侧显示渐变遮罩（不需要提示左滑）
- ❌ 不使用独立的悬浮按钮
- ✅ 右侧渐变遮罩可点击（整个遮罩区域触发滚动）
- ✅ 箭头嵌入渐变中，颜色低调不突兀

**3. 移动端适配**

```css
/* 移动端不需要悬浮按钮，依赖手势滑动 */
@media (max-width: 768px) {
  .scroll-button {
    display: none;
  }
}
```

### 10.5 可访问性 (A11y)

```typescript
// 键盘导航支持
<div
  role="region"
  aria-label="全部角色列表"
  tabIndex={0}
>
  {/* 卡片 */}
</div>

// 右侧渐变遮罩 aria 标签
<button
  aria-label="向右滚动查看更多角色"
  className="absolute right-0 top-0 bottom-0 w-16 z-10 cursor-pointer"
>
  {/* 渐变背景 + 低调箭头 */}
</button>
```

---

**文档结束**

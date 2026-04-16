# Design System — Role-Playing AI Learning Platform

---

## 1. Product UI Positioning

### 1.1 Product Definition

+ 这个应用是什么：
    - 一个 AI 角色互动的沉浸式英语学习产品

+ 这个应用主要做什么：
    - 让用户创建 AI 角色，与角色进行对话学习英语，在互动中提升语言能力

+ 这个应用的目标用户是什么：
    - 喜欢角色扮演、AI 陪伴、剧情互动的用户，以及希望通过沉浸式对话学习英语的学习者

### 1.2 Product Type

+ 这个产品在界面上首先应该像什么：
    - 沉浸式互动空间 / AI 角色舞台 / 智能陪伴界面

+ 这个产品不应该像什么：
    - 后台工具 / 通用聊天壳子 / 功能堆砌页 / 普通社区 feed

### 1.3 Core UI Promise

界面必须首先传达：

+ 主任务是什么：与 AI 角色对话互动
+ 谁是主角：AI 角色（而非用户）
+ 当前焦点是什么：对话内容与角色本身
+ 用户下一步最可能做什么：发送消息继续对话

### 1.4 Emotional Direction

界面最终应给人的感受：

+ 沉浸 / 温暖 / 精致 / 智能 / 友好 / 轻快

界面绝不能给人的感受：

+ 廉价 / 杂乱 / 后台感 / 默认组件库感 / 炫技过度

---

## 2. Visual North Star

### 2.1 One-Paragraph Visual Thesis

这是一个面向消费者的 AI 英语学习产品，界面应传达沉浸式角色互动的温暖感。整体视觉语言融合现代极简主义与轻量玻璃拟态效果，营造出智能而不冰冷、友好而不幼稚的氛围。界面空间感强调"呼吸感"——大量留白让角色成为视觉焦点，聊天区域成为用户自然停留的舞台。整体体验应让用户感到"在一个专属的 AI 角色空间里探索"而非"使用一个聊天工具"。

### 2.2 Visual Keywords

+ 玻璃拟态（Glass Morphism）
+ 温暖渐变
+ 沉浸空间感
+ 角色聚焦
+ 轻量柔和阴影

### 2.3 Anti-Keywords

+ 高饱和度撞色
+ 粗边框分割
+ 密集信息流
+ 企业级蓝白
+ Skeuomorphism 拟物

---

## 3. Layout & Composition

### 3.1 Layout Character

整体布局气质应为：

+ 内容优先 / 中轴稳定 / 非对称但平衡 / 编辑感

整体布局不应为：

+ 随意堆叠 / 每个元素等权重 / 无视觉动线 / 密集填充

### 3.2 Alignment Discipline

界面必须给人以下感受：

+ 对齐是有纪律的
+ 分组是有逻辑的
+ 留白是有意图的
+ 元素不是被随意堆上去的

界面不得出现以下情况：

+ 同一页面存在多套对齐基准
+ 相关元素之间距离远于无关元素
+ 留白分布随机，无法建立视觉节奏

### 3.3 Density Strategy

整体密度倾向：

+ 中等偏松

**实际代码密度观察：**

| 区域 | 实际间距 | 说明 |
|------|---------|------|
| Discover 页面边距 | `p-8`（32px） | 页面级间距 |
| CharacterCard 网格 gap | `24px` | 卡片间距 |
| Sidebar 内部间距 | `px-2`（8px）+ `gap-1` | 紧凑列表 |
| Sidebar 列表项高度 | `h-[52px]`（展开）/ `h-10`（收起） | 切换动画 |
| ChatHeader | `h-[64px]` + `px-[14px]` | 固定高度，紧凑 |
| ChatMessage 横向padding | `px-3 sm:px-4 lg:px-0` | 响应式递增 |
| ChatInput Composer | `p-2.5` + `28px` 圆角 | 内边距偏小 |
| 对话气泡内边距 | `px-4 py-1.5` | 紧凑但可读 |
| 消息间距 | `mt-1`（相邻消息） | 极小间距 |

允许更密的区域：

+ 角色卡片网格（Discover 页面）
+ 标签列表
+ 聊天消息列表
+ 设置项列表

必须更松的区域：

+ 首屏 Hero 区域（当前无明确 Hero）
+ 角色卡片内部信息区（padding 16px）
+ 核心输入区（ChatInput）
+ 对话气泡与边缘的安全距离

### 3.4 White Space Strategy

留白必须承担以下职责：

+ 建立主次（次要信息周围留白更多）
+ 切分区域（区块间留白传达分隔）
+ 给内容呼吸（特别是头像、角色卡片）
+ 强化焦点（焦点内容周围更疏）
+ 提升品质感（克制但充足的留白）

留白不得用于：

+ 掩盖结构混乱
+ 填补内容缺失
+ 随机分布而不承担视觉职责

### 3.5 Edge Discipline

**实际代码中的页面边距：**

| 断点 | 实际边距 | 说明 |
|------|---------|------|
| `< 640px`（sm） | `1rem`（16px） | 移动端 |
| `640px - 1024px`（lg） | `1.5rem`（24px） | 平板 |
| `>= 1024px`（lg+） | `4rem`（64px） | 桌面端 |

```css
.thread-content-margin {
  --thread-content-margin: 1rem;  /* 16px */
}
@media (min-width: 640px) {
  .thread-content-margin {
    --thread-content-margin: 1.5rem;  /* 24px */
  }
}
@media (min-width: 1024px) {
  .thread-content-margin {
    --thread-content-margin: 4rem;  /* 64px */
  }
}
```

**ChatInput Composer 的响应式边距：**
- 使用 CSS 变量 `--thread-content-margin` 控制左右 padding
- 最大宽度 `--thread-content-max-width: 48rem`（768px）

**页面不应给人：**
+ 贴边（元素紧贴容器边缘）
+ 顶满（内容占据所有可用空间）
+ 塞满（每个区块都在抢空间）

**页面应给人：**
+ 安全（边距是保护而非限制）
+ 从容（元素有呼吸空间）
+ 有边界感（内容有明确的"停靠点"）
+ 有停顿感（区块间有节奏）

### 3.6 Responsive Continuity

不同尺寸下必须保持不变的东西：

+ 主任务的清晰度（对话是核心）
+ 主次关系（角色 > 工具栏）
+ 产品气质（温暖、沉浸、精致）
+ 可读性（文字大小、间距比例）
+ 核心区域的辨识度（ChatInput、Sidebar）

---

## 4. Color System

### 4.1 Color Philosophy

整体配色应使用少量关键颜色，不追求颜色丰富，优先追求：

+ 主次清楚（背景 → 表面 → 焦点）
+ 长时间观看不累（低饱和度为主）
+ 重点明确（Primary 稀缺且精准）
+ 风格统一（所有颜色服务于同一气质）

颜色应按"界面职责"定义，而不是按"能不能再多加一个色"定义。

### 4.2 Key Colors

**重要说明：项目使用两套颜色系统**

1. **shadcn/ui 语义颜色**（通过 Tailwind 类名使用，如 `bg-primary`、`text-primary`）：
   - 这些使用 OKLCH 色值，定义在 CSS 变量中

2. **自定义应用颜色**（直接使用的语义化变量）：
   - 这些用于特定组件和场景

**shadcn/ui 语义 Token（Light Mode）：**

| Token | OKLCH 值 | 用途 |
|-------|---------|------|
| `--background` | oklch(1 0 0) | 页面背景 |
| `--foreground` | oklch(0.141 0.005 285.823) | 主要文字 |
| `--primary` | oklch(0.21 0.006 285.885) | shadcn Button 默认态，**不是紫色** |
| `--primary-foreground` | oklch(0.985 0 0) | primary 上文字 |
| `--secondary` | oklch(0.967 0.001 286.375) | 次要背景 |
| `--muted` | oklch(0.967 0.001 286.375) | 静音背景 |
| `--muted-foreground` | oklch(0.552 0.016 285.938) | 次要文字 |
| `--accent` | oklch(0.967 0.001 286.375) | 强调背景 |
| `--destructive` | oklch(0.577 0.245 27.325) | 危险/错误 |
| `--border` | oklch(0.92 0.004 286.32) | 边框 |
| `--input` | oklch(0.92 0.004 286.32) | 输入框背景 |
| `--ring` | oklch(0.705 0.015 286.067) | 焦点环 |

**自定义应用颜色（实际使用的品牌色）：**

| CSS 变量 | Hex 值 | 实际用途 |
|----------|--------|---------|
| `--bg-primary` | `#FFFFFF` | 页面背景（body 背景） |
| `--text-primary` | `#0D0D0D` | 主要文字 |
| `--text-secondary` | `#5D5D5D` | 次要文字 |
| `--text-tertiary` | `#8F8F8F` | 辅助/占位符文字 |
| `--theme-submit-btn-bg` | `#0285FF` | 提交按钮背景（ChatComposer） |
| `--theme-submit-btn-text` | `#FFFFFF` | 提交按钮文字 |
| `--send-button` | `#924FF7` | **发送按钮紫色**（ChatComposer） |
| `--user-bubble` | `#E5F3FF` | 用户聊天气泡背景 |
| `--sidebar-bg` | `#FAFAFA` | 侧边栏背景 |
| `--workspace-bg` | `#F2F2F2` | 工作区背景 |
| `--divider` | `#D5D5D5` | 分割线 |
| `--input-border` | `#DEDEDE` | 输入框边框 |

### 4.3 Usage Rules

**shadcn 组件使用语义 Token：**
- Button 默认态使用 `bg-primary`
- 危险操作使用 `bg-destructive`
- 表单输入使用 `border-input`

**Chat Composer 特定逻辑：**
- 发送按钮（圆形）：使用 `--send-button`（紫色 `#924FF7`）
- 暂停/中断按钮：使用 `--theme-submit-btn-bg`（蓝色 `#0285FF`）
- 辅助按钮（如 plus、mic）：使用 `--interactive-bg-secondary-hover`

**CreateCharacterModal 特定逻辑：**
- 创建按钮：直接使用 `#3964FE`（品牌蓝）

**登录/注册页面：**
- 使用原生 Tailwind 类（如 `bg-blue-600`），不经过设计系统

**颜色优先级：**
1. 如果一个页面同时有多个彩色焦点，说明颜色使用失败
2. 语义 Token 用于 shadcn 组件
3. 自定义变量用于特定功能组件
4. 直接 Hex 色值仅用于 brand 颜色或一次性场景

### 4.4 Dark Theme Note

深色模式通过 `.dark` 类切换，覆盖 OKLCH 语义 Token：

| Token | Light OKLCH | Dark OKLCH |
|-------|-------------|------------|
| `--background` | oklch(1 0 0) | oklch(0.141 0.005 285.823) |
| `--foreground` | oklch(0.141 0.005 285.823) | oklch(0.985 0 0) |
| `--primary` | oklch(0.21 0.006 285.885) | oklch(0.92 0.004 286.32) |
| `--card` | oklch(1 0 0) | oklch(0.21 0.006 285.885) |
| `--sidebar` | oklch(0.985 0 0) | oklch(0.21 0.006 285.885) |
| `--border` | oklch(0.92 0.004 286.32) | oklch(1 0 0 / 10%) |
| `--input` | oklch(0.92 0.004 286.32) | oklch(1 0 0 / 15%) |

**注意：** 自定义应用颜色变量（如 `--send-button`、`--user-bubble`）在深色模式下**未定义**，深色模式聊天气泡等使用默认值。

---

## 5. Type System

### 5.1 Typography Philosophy

排版应优先承担以下职责：

+ 建立信息层级（标题 > 正文 > 辅助）
+ 提升扫描效率（行高、字重对比）
+ 保持阅读舒适度（行长度、间距）
+ 形成统一气质（Inter 的现代中性）

字体家族不超过 3 个：Inter（UI）、Noto Sans SC（中文正文）、JetBrains Mono（代码/数字）。

### 5.2 Type Structure

**实际代码中的字体变量：**

| CSS 变量 | 字体栈 | 用途 |
|----------|--------|------|
| `--font-inter` | Inter Variable（本地加载） | 主字体，weight 100-900 |
| `--font-noto-sans-sc` | Noto Sans SC Variable（本地加载） | 中文正文 |
| `--font-mono` | JetBrains Mono, ui-monospace | 代码/数字串 |

**Tailwind font-sans 映射：**
```css
--font-sans: var(--font-inter);
```

**实际字体应用（body）：**
```css
body {
  font-family: var(--font-inter), var(--font-noto-sans-sc), -apple-system,
               system-ui, "Segoe UI", Helvetica, Arial, sans-serif,
               "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
}
```

**字重规范（实际代码）：**
```css
h1, h2, h3, h4, h5, h6, b, strong, .font-bold, .font-extrabold, .font-black {
  font-weight: 600;  /* 最大只到 semibold，不使用 bold/extrabold/black */
}
```

**文字角色定义（基于实际使用）：**

| Role | 用途 | 视觉特征 |
|------|------|---------|
| **type-display** | 产品名称、品牌标题（如"NeuraChar"） | 字重 700（bold），字号 24-32px |
| **type-title** | 页面标题、区块标题、卡片标题 | 字重 600（semibold），字号 16-20px |
| **type-body** | 正文、描述、对话内容 | 字重 400，字号 14-16px，行高 1.5 |
| **type-label** | 按钮、输入标签、操作文案 | 字重 500-600，字号 13-15px |
| **type-meta** | 时间、状态、辅助信息 | 字重 400，字号 11-13px，颜色 tertiary |

**实际字号应用示例：**
- ChatHeader: `text-base font-semibold`
- Sidebar character name: `text-sm font-medium`
- Sidebar character desc: `text-xs`（无额外字重）
- Card name: `text-lg font-bold`

### 5.3 Typographic Tone

整体文字气质应为：

+ 清楚 / 现代 / 中性 / 克制 / 编辑感

正文阅读体验应为：

+ 易扫读（足够行高 1.5+）
+ 不压迫（适当字重，全站最大字重 600-semibold）
+ 不发飘（深色文字 #0D0D0D，不褪光）
+ 可持续阅读（合理行长度，thread max-width: 44rem）

**聊天区域最大宽度（实际代码）：**
```css
.thread-content-max-width {
  --thread-content-max-width: 40rem;  /* 640px */
}
@media (min-width: 1024px) {
  .thread-content-max-width {
    --thread-content-max-width: 48rem;  /* 768px */
  }
}
```

---

## 6. Surface, Depth, and Shape

### 6.1 Surface Model

界面需要明确的表面层次：

+ **基底层**（background）：承载整体空间，纯色 `#FFFFFF`
+ **区块层**（surface）：区分页面区域，如 Sidebar `#FAFAFA`
+ **内容层**（card）：承载主要信息，白色卡片
+ **浮层**（elevated）：承载短时任务或强调信息，阴影更重

表面层次不得出现以下情况：

+ 多个层级使用相同视觉权重，导致前后关系模糊
+ 浮层与内容层无法区分
+ 用大量边框线代替层级关系

### 6.2 Depth Perception

用户应自然感到：

+ 有前后关系（通过阴影层次）
+ 有主次关系（焦点内容更突出）
+ 有轻重关系（背景退后，内容前进）
+ 重要内容被托出来（更大的阴影、更亮的表面）
+ 背景自然退后（饱和度更低）

深度感不得依赖：

+ 大量投影堆叠（最多 4 层，且从轻到重）
+ 高对比度边框
+ 颜色差异过大导致割裂感

### 6.3 Boundary Style

边界应给人的感觉：

+ 清楚（边界存在但不死硬）
+ 克制（只用 1px 或更轻）
+ 不生硬（可用圆角柔化）
+ 不依赖粗边框维持结构

边界不得出现以下情况：

+ 每个区块都有独立边框，页面变成格子
+ 分割线颜色比内容本身更抢眼
+ 用边框补偿布局结构的缺失

### 6.4 Shape Language

**实际代码中的 Border Radius：**

| 元素 | 实际 Radius | 说明 |
|------|------------|------|
| Avatar | `rounded-full` | 全圆形，用于 Sidebar、ChatHeader |
| Chat bubble | `10px` | 固定值，圆角矩形 |
| Input container | `24px` | 大圆角胶囊形 |
| Composer buttons | `340282000000000000000px`（接近无穷大 = 胶囊形） | composer-btn 专用 |
| CharacterCard | `20px` | 玻璃拟态卡片 |
| Send button | `50%`（圆形） | 36x36 圆形按钮 |
| Suggestion card | 无额外 radius（使用 border 默认） | 3D 浮雕卡片 |
| shadcn Card | `rounded-xl`（--radius-lg） | 默认 10px |

**形状语言总结：**

+ **Avatar**: `rounded-full` — 全圆形，传达用户身份
+ **聊天输入区**: 大圆角 `24px` 胶囊形 — 友好、可点击
+ **聊天气泡**: `10px` — 轻圆角，不过于刻板
+ **发送按钮**: `50%` 圆形 — 明确的行动号召
+ **CharacterCard**: `20px` — 卡片感、沉浸感

**按钮形状规则（实际代码）：**
```css
/* Composer 辅助按钮 - 胶囊形 */
.composer-btn {
  border-radius: 340282000000000000000px;  /* 近似无穷大 = 全胶囊 */
}

/* 发送按钮 - 圆形 */
.send-button {
  border-radius: 50%;
  width: 36px;
  height: 36px;
}

/* 输入框容器 */
.input-container {
  border-radius: 24px;
}
```

**Hover/Active 动效（按钮）：**
```css
.send-button:hover {
  transform: scale(1.05);  /* 放大 5% */
}
.send-button:active {
  transform: scale(0.95);  /* 缩小 5% */
}
```

---

## 7. Spacing & Grid System

### 7.1 Spacing Unit

+ 基础单位：**4px**（`--spacing: 0.25rem`）
+ 所有间距值必须是基础单位的倍数
+ 不允许出现基础单位之外的随意数值

**实际代码中的基础单位：**
```css
--spacing: 0.25rem;  /* 4px */

/* 实际应用示例 */
.composer-btn {
  height: calc(var(--spacing) * 9);  /* 36px */
  min-width: calc(var(--spacing) * 9);  /* 36px */
}
```

### 7.2 Spacing Scale

允许使用的间距序列（单位：4px）：

| Token | Value | Tailwind | 实际用途 |
|-------|-------|----------|---------|
| 1 | 4px | `1` | 图标与文字间距 |
| 2 | 8px | `2` | 紧凑间距、元素内 gap |
| 3 | 12px | `3` | 组件内部元素间距 |
| 4 | 16px | `4` | 标准间距、输入框内边距 |
| 6 | 24px | `6` | 区块内间距、CharacterCard 网格 |
| 8 | 32px | `8` | 区块间分隔、页面 padding |
| 12 | 48px | `12` | 页面级分隔 |
| 16 | 64px | `16` | 大区块分隔 |

**实际代码间距示例：**

```css
/* CharacterCard 网格 */
.card-grid {
  gap: 24px;  /* 6 单位 */
}

/* ChatInput Composer */
.composer-btn {
  height: calc(var(--spacing) * 9);  /* 36px = 9 单位 */
}

/* Sidebar 列表项 */
h-[52px]  /* 52px = 13 单位（展开态）*/

/* ChatHeader */
h-[64px]  /* 64px = 16 单位 */
```

较小值用于：

+ 图标与文字间距（4-8px）
+ 标签内边距（8px）
+ 行内元素间隔（8-12px）

较大值用于：

+ 区块间距（24-32px）
+ 页面级分隔（48-64px）
+ 首屏留白（32px p-8）

### 7.3 Page Margins

+ 移动端页面横向边距：**16-20px**
+ 桌面端页面横向边距：**24-64px**
+ 页面顶部与核心内容之间：**中等偏宽松，给产品气质留空间**

### 7.4 Spacing Intention

间距的分配必须服务于信息层级，而不是均匀填充：

+ 相关的元素之间间距小（4-8px）
+ 不相关的区块之间间距大（24-48px）
+ 主要内容周围的间距应明显大于次要内容

---

## 8. Motion & Animation

### 8.1 Motion Philosophy

整体动效气质应为：

+ 克制 / 功能性 / 自然 / 几乎无感知

动效的存在目的只有两个：

+ 帮助用户理解状态变化（hover、active、loading）
+ 维持空间连续感（展开/收起、页面过渡）

动效不得用于：

+ 装饰或炫技
+ 吸引注意力到非核心区域
+ 制造视觉噪音

### 8.2 Duration Boundaries

**实际代码中的动效时长：**

| 类型 | 实际时长 | 代码位置 |
|------|---------|---------|
| Modal 出现 | 200ms | `.animate-modal-in { animation: modal-in 0.2s ease-out; }` |
| Hover 反馈 | 200ms | `.send-button:hover { transition: all 0.2s ease; }` |
| Input focus | 200ms | `.input-container:focus-within { transition: all 0.2s ease; }` |
| Send button scale | 200ms | `.send-button:hover { transform: scale(1.05); }` |
| Liquid glass hover | 300ms | `.liquid-glass:hover { transition: all 0.3s ease; }` |
| Sidebar collapse | 300ms | 侧边栏宽度动画 |
| CharacterCard hover | 400ms | `.glass-card:hover { transition: all 0.4s cubic-bezier(...); }` |
| Speaker wave | 1000ms（循环） | `@keyframes speakerWaveShow` |

**建议规范：**

| 类型 | 时长范围 |
|------|---------|
| 微交互（hover、focus、toggle） | 100-200ms |
| 元素出现 / 消失 | 150-250ms |
| 页面级过渡 | 200-350ms |
| Sidebar 动画 | 300ms |
| 卡片 hover | 300-400ms |
| 超过 **400ms** 的动画必须有充分理由 | 禁止 |

### 8.3 Prohibited Motion

以下动效类型在任何情况下都不允许使用：

+ bounce / spring 弹性动效
+ 过度 scale 放大（**超过 1.05**）— 实际代码最大 scale 为 1.05
+ 装饰性粒子
+ 循环播放的背景动画（loading spinner 除外）
+ 闪烁动画

**实际代码中的 active scale：**
```css
.send-button:hover { transform: scale(1.05); }
.send-button:active { transform: scale(0.95); }  /* 注意：最大放大是 1.05，不是 1.1 或更大 */
```

---

## 9. Conflict Resolution

当设计决策面临规则冲突时，按以下优先级裁决，序号越小越优先：

1. **可读性** — 用户必须能看清、看懂
2. **气质一致性** — 产品的整体感受不能被局部破坏
3. **功能完整性** — 核心功能不能因为追求视觉而残缺
4. **留白与克制** — 宁可少，不要为了填满而填满
5. **视觉精致度** — 在前四条满足之后，再追求细节美感

当某个决策同时违反多条规则时，优先修复序号最小的冲突。
当规则本身无法覆盖某个情况时，回到 Section 2（Visual North Star）寻找答案。

---

## 10. Experience
### Design Knowledge

This is an AI role-playing English learning website aimed at consumers. Users can create characters on the platform and talk with them, learning music during the conversations.

### DropdownMenu (shadcn) sideOffset Behavior

`s ideOffset` controls the **vertical distance** between the trigger element and the dropdown menu, not the left margin.

| Property | Controls | Notes |
|----------|----------|-------|
| `side` | Position relative to trigger (top/bottom/left/right) | `side="top"` places menu above trigger |
| `sideOffset` | **Vertical** gap between trigger and menu | Increases = menu moves **down** when side=top |
| `align` | Horizontal alignment (start/center/end) | Controls left/right alignment |

Example:
- `side="top"` + `sideOffset={10}` = menu appears above trigger, 10px gap
- `sideOffset={6}` = smaller gap, menu closer to trigger

---

### Input Component: `focus` vs `focus-visible`

When customizing Input component focus styles, using `focus:` doesn't work because shadcn's Input uses `focus-visible:` instead.

```tsx
// src/components/ui/input.tsx default styles:
"focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
```

**`focus` vs `focus-visible`:**
- `focus` — always triggers when element is focused
- `focus-visible` — only triggers when focused via keyboard (not mouse click)

**Incorrect (won't override default):**
```html
className="... focus:outline-none"
```

**Correct approach:**
```html
className="... focus-visible:outline-none focus-visible:ring-0 focus-visible:!border-gray-200"
```

The `!` is Tailwind's important flag to ensure the style has highest priority.

---

### Dropdown Trigger: Keep the Default Border, Only Remove the Extra Focus Ring

When fixing a shadcn `DropdownMenuTrigger` that shows an unwanted gray border after open / select / outside-click close, do **not** remove the trigger's normal border.

The actual problem is usually:

- the default shadcn button uses `focus-visible:border-ring`
- and `focus-visible:ring-[3px]`
- so after focus is handed back to the trigger, a temporary extra border / ring appears

**Wrong fix:**

```tsx
className="border-transparent hover:border-transparent focus-visible:border-transparent focus-visible:ring-0"
```

This removes the abnormal focus border, but it also removes the component's intended resting border, making the trigger look flatter than the prototype.

**Correct fix for outline-style dropdown triggers:**

```tsx
className="border-gray-200 bg-white shadow-none hover:border-gray-200 hover:bg-background focus-visible:!border-gray-200 focus-visible:ring-0 focus-visible:outline-none"
```

**Rule:**

- Keep the trigger's normal border color in resting / hover state
- Keep the same border color in `focus-visible`
- Remove only the extra ring / outline if the prototype does not want it
- Do not use `border-transparent` unless the design truly has no border in the resting state

This is a **stable border ownership** problem, not a "remove all borders" problem.

---

### Search Input Container: Border Ownership and Focus Synchronization

When a search box uses a **custom outer container** to draw the border, background tint, and focus halo, that outer container must own the focus UI in **every state**.

**Two mistakes caused the Discover search box bug:**

1. Focus state only used `border-blue-500` without also keeping `border`
2. Blue focus state was controlled by React state, but the state did not fully track real blur / outside-click behavior

**Why the first bug happens:**
- `border-blue-500` only changes border color
- It does **not** create border width by itself
- If the default state has `border` but the focus state does not, the border disappears on focus
- When blur adds `border` back, the border can briefly flash in the previous focus color before transitioning out

**Correct pattern:**
```tsx
<div
  className={cn(
    "rounded-xl border transition-[border-color,background-color,box-shadow] duration-200",
    isFocused
      ? "border-blue-500 bg-blue-50 shadow-[0_0_0_3px_rgba(59,130,246,0.12)]"
      : "border-black/10 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
  )}
>
```

**Rule:** the container should always keep the same border width; focus / blur should only switch:
- border color
- background tint
- focus halo / shadow

**Inner input rule:**
- If the outer container owns the visual focus treatment, the inner shadcn `Input` should be visually neutral:
  - `border-0`
  - `shadow-none`
  - `focus-visible:ring-0`

This prevents the inner input and outer container from fighting over focus styling.

**Focus synchronization rule:**
- If focus UI is driven by React state, that state must follow the **real active element**, not only `onFocus`
- Outside-click detection should be attached to the **whole search container**, not just the dropdown panel
- Also add a blur-time sync check against `document.activeElement` so the blue border is removed when the caret is already gone

**Recommended pattern:**
```tsx
const searchContainerRef = useRef<HTMLDivElement>(null);

const syncFocusState = () => {
  requestAnimationFrame(() => {
    if (
      searchContainerRef.current &&
      !searchContainerRef.current.contains(document.activeElement)
    ) {
      setIsFocused(false);
    }
  });
};
```

**Design takeaway:**
- Focus UI should feel stable, not event-driven or glitchy
- The user should never see:
  - border disappear on focus
  - blue border remain after the caret is gone
  - blur causing a flash of the previous focus color

For search inputs specifically, **stable border ownership + real focus synchronization** is the required baseline.

---

### Input Component: `::selection` with `bg-transparent`

When Input component has `bg-transparent` + Tailwind `selection:` utility, selection color may not show properly in Chrome 131+.

**Root cause:** Tailwind's `selection:` generates CSS variables that conflict with `bg-transparent` in modern Chrome.

**Incorrect (selection not showing):**
```html
className="... bg-transparent selection:bg-primary"
```

**Correct approach (use arbitrary variant):**
```html
className="... bg-transparent [&::selection]:bg-blue-500 [&::selection]:text-white"
```

**Why this works:**
- `[&::selection]` directly targets the `::selection` pseudo-element
- Bypasses Tailwind's CSS variable system
- Works consistently across browsers

---

### Text Selection Overlay: Avoid React State for Selection Buttons

When showing a floating action button after the user selects text, do not use React state just to reveal or position that button.

**Problem:**
- `mouseup` reads `window.getSelection()`
- calling `setState(...)` to show the button triggers a React re-render
- if the selected text lives inside React-managed content such as `react-markdown`, the underlying text nodes may be replaced during commit
- the browser selection is tied to those DOM nodes, so the highlight disappears even though the selected string was already captured

**Incorrect pattern:**
```tsx
const [selectionButton, setSelectionButton] = useState(null);

function handleTextSelection() {
  const selection = window.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  if (!range) return;

  setSelectionButton({
    top: range.getBoundingClientRect().bottom,
    left: range.getBoundingClientRect().left,
  });
}
```

**Recommended pattern:**
- keep the floating button mounted all the time in a portal
- store selection metadata in `useRef`, not `useState`
- update button position and visibility through the DOM node ref
- only enter the normal React state flow when the user actually clicks the button
- keep `onMouseDown(e => e.preventDefault())` on the button so clicking it does not clear the current selection

**Correct approach:**
```tsx
const buttonRef = useRef<HTMLButtonElement | null>(null);
const selectionDataRef = useRef<SelectionButtonData | null>(null);

function showSelectionButton(data: SelectionButtonData) {
  selectionDataRef.current = data;
  const button = buttonRef.current;
  if (!button) return;

  button.style.top = `${data.top}px`;
  button.style.left = `${data.left}px`;
  button.style.visibility = "visible";
  button.style.opacity = "1";
  button.style.pointerEvents = "auto";
}
```

**Rule of thumb:**
- if an interaction depends on preserving the browser's native selection, avoid re-rendering the selected content subtree
- for transient selection affordances, prefer `ref` + persistent overlay DOM over `state` + conditional rendering

---

### Async State Timing: Loading vs Active State

When implementing UI feedback for async operations (e.g., audio playback), distinguish between **loading state** and **active state**.

**Problem:**
- Click speaker button → UI immediately shows "playing" animation
- But audio actually starts later (network fetch + decode)
- User sees animation but no sound = confusing feedback

**Root cause:**
- The async operation has multiple phases (fetch → decode → play)
- UI state was set at the wrong phase (before audio actually started)

**Solution: Two-phase state management**

| State | When | Purpose |
|-------|------|---------|
| `loadingCandidateId` | Set immediately on click | Shows loading spinner |
| `playingCandidateId` | Set when `source.start()` is called | Shows active animation |

**Incorrect pattern:**
```tsx
async function playMessage(candidateId: string) {
  setPlayingId(candidateId);  // Set too early!
  const audioBuffer = await fetchAndDecode();
  source.start(0);  // Audio actually starts here, but UI already showing "playing"
}
```

**Correct pattern:**
```tsx
async function playMessage(candidateId: string) {
  // Don't set playing state here
  const audioBuffer = await fetchAndDecode();
  source.start(0);  // Audio actually starts
  setPlayingId(candidateId);  // Now UI matches reality
  onAudioReady?.(candidateId);
}
```

---

### Prop Chain Completeness Check

When adding a new prop that flows through multiple component layers (page → ChatThread → ChatMessage), always verify the prop is passed at **every level**.

**Problem:**
- Added `ttsLoadingCandidateId` state to page.tsx
- Passed it to ChatThread ✓
- Forgot to pass it from ChatThread to ChatMessage ✗
- Bug: loading spinner never showed up

**Lesson:**
- When creating a new prop, document which components need to receive it
- After implementation, verify the entire prop chain: grep for the prop name across all intermediate components
- Use TypeScript interface updates to catch missing props at compile time

**Verification checklist:**
```bash
# Search for prop usage across the chain
grep -n "ttsLoadingCandidateId" src/app/\(app\)/chat/\[id\]/page.tsx
grep -n "ttsLoadingCandidateId" src/components/chat/ChatThread.tsx
grep -n "ttsLoadingCandidateId" src/components/ChatMessage.tsx
```

---

### Speaker Button Wave Animation

Implement a speaker icon with animated sound waves, using inline SVG + CSS animations.

#### SVG Structure

The speaker icon is an inline SVG with two parts: the speaker body and the wave arcs.

```tsx
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 20 20"
  fill="none"
  aria-hidden="true"
  className={`h-5 w-5 shrink-0${isSpeakerPlaying ? " speaker-playing" : ""}`}
>
  {/* Speaker body - filled path */}
  <path
    className="speaker-body"
    d="M9.751 4.092a.585.585 0 0 0-.907-.49l-.072.058-2.218 2.033a3.06 3.06 0 0 1-1.785.792l-.286.013c-.958 0-1.735.778-1.735 1.736v3.533c0 .958.777 1.734 1.735 1.734.766 0 1.506.288 2.071.806l2.218 2.033.072.057a.585.585 0 0 0 .907-.489zM11.081 15.908c0 1.615-1.859 2.483-3.091 1.512l-.118-.1-2.216-2.033a1.74 1.74 0 0 0-1.173-.456 3.065 3.065 0 0 1-3.065-3.064V8.234a3.065 3.065 0 0 1 3.065-3.066l.162-.008c.375-.035.73-.191 1.01-.448L7.873 2.68l.117-.1c1.233-.971 3.092-.102 3.092 1.512z"
    fill="currentColor"
  />

  {/* Wave arcs - stroke only, no fill */}
  <path className="speaker-wave wave1" d="M12.5 7.5Q14.5 10 12.5 12.5" />
  <path className="speaker-wave wave2" d="M14.0 6.0Q17.0 10 14.0 14.0" />
  <path className="speaker-wave wave3" d="M15.5 4.5Q19.5 10 15.5 15.5" />
</svg>
```

#### Wave Path Design (Quadratic Bezier)

The waves use quadratic bezier curves (`Q` command) for smooth arcs:

```
d="M12.5 7.5Q14.5 10 12.5 12.5"
  ↑       ↑    ↑    ↑
 起点    控制点  终点
```

- **M**: Move to start point
- **Q**: Quadratic bezier to end point with control point
- Control point determines the curvature direction and amount

The three waves have increasing arc sizes:
- `wave1`: Smallest arc (closer to speaker body)
- `wave2`: Medium arc
- `wave3`: Largest arc (farthest from speaker)

#### CSS Animation

```css
/* Base wave styles */
.speaker-wave {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 1;
  transform-origin: 10px 10px;
}

/* All waves visible when not playing */
.speaker-wave.wave1,
.speaker-wave.wave2,
.speaker-wave.wave3 {
  opacity: 1;
}

/* Playing state: staggered animations */
.speaker-playing .speaker-wave.wave1 {
  animation: speakerWaveShow 1s infinite;
  animation-delay: 0s;
}

.speaker-playing .speaker-wave.wave2 {
  animation: speakerWaveShow 1s infinite;
  animation-delay: 0.16s;
}

.speaker-playing .speaker-wave.wave3 {
  animation: speakerWaveShow 1s infinite;
  animation-delay: 0.32s;
}

@keyframes speakerWaveShow {
  0% {
    opacity: 0;
    transform: scale(0.92);
  }
  25% {
    opacity: 1;
    transform: scale(1);
  }
  65% {
    opacity: 1;
    transform: scale(1.03);
  }
  100% {
    opacity: 0;
    transform: scale(0.96);
  }
}
```

#### Key Design Decisions

1. **Inline SVG over mask/image**
   - Inline SVG allows CSS control over individual paths
   - Can animate stroke, opacity, transform independently
   - Using `currentColor` makes it respect text color

2. **Transform-origin at speaker center**
   - `transform-origin: 10px 10px` (center of 20x20 viewBox)
   - Ensures waves scale from the speaker body outward

3. **Staggered animation delays**
   - Each wave starts 160ms after the previous
   - Creates the "wave appearing one by one" effect

4. **Animation loop structure**
   - `0%`: Fade in + scale up (invisible → visible, small → normal)
   - `25-65%`: Stay visible at full scale
   - `100%`: Fade out + scale down (preparing for next cycle)
   - `infinite` loop keeps the animation going

5. **Idle state: all waves visible**
   - When not playing, all three waves are static and visible
   - User can see the speaker icon clearly

6. **Three visual states**
   - Loading: Spinning circle (before audio ready)
   - Playing: Animated waves (audio playing)
   - Idle: Static waves (not playing)

---

### Fixing the "Jumpy" Hover Expansion: CSS Grid Instead of `max-height`

#### Problem

When a card expands on hover, using a `max-height` transition often causes a jumpy / unsmooth effect.

**Root cause:** `max-height` requires a value much larger than the actual content height (for example, 150px), but the real content may only be 80px tall. The browser calculates the animation speed based on 40→150px (110px), while the actual content reaches its final height at 40→80px (the first 36% of the duration). The remaining 64% of the animation is effectively "running in empty space" — visually, it looks like the content pops open instantly and then just sits there. The reverse collapse has the same issue: nothing appears to happen for the first 64%, then it suddenly shrinks at the end.

#### Solution: CSS Grid `0fr → 1fr`

Use a `grid-template-rows` transition from `0fr` to `1fr` instead of `max-height`. The browser will calculate the real content height precisely and animate smoothly to exactly that height.

```html
<!-- Expandable content container -->
<div class="grid grid-rows-[0fr] group-hover/card:grid-rows-[1fr]
    transition-[grid-template-rows] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]">
    <!-- Must have overflow-hidden + min-h-0, otherwise 0fr cannot truly collapse to 0 -->
    <div class="overflow-hidden min-h-0">
        <div class="p-3">Actual content</div>
    </div>
</div>
````

**Key points:**

* The grid child must have `overflow: hidden` + `min-height: 0`, otherwise `0fr` cannot fully collapse the row to 0
* `transition-property` only needs `grid-template-rows`; do not use `transition-all` (to avoid interfering with other properties)
* The parent container does not need a fixed height; the height change of the grid child will naturally drive the parent to resize with it

**Comparison:**

| Approach       | Precision                                                                  | Animation Smoothness      | Browser Support   |
| -------------- | -------------------------------------------------------------------------- | ------------------------- | ----------------- |
| `max-height`   | Requires guessing a value; the larger the mismatch, the less even it feels | ❌ Severe dead-zone effect | ✅ Fully supported |
| Grid `0fr→1fr` | Browser calculates precisely                                               | ✅ Even throughout         | ✅ Modern browsers |

---

### Card Depth: Multi-layer Shadows + Directional Border

Create an embossed / dimensional card look using 4 layers of box-shadow plus differentiated border colors, without any images or extra DOM.

```css
.suggestion-card {
  background: #ffffff;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.06),      /* Outer shadow 1: close projection */
    0 2px 6px rgba(0, 0, 0, 0.03),      /* Outer shadow 2: ambient light */
    inset 0 1px 0 rgba(255,255,255,0.9), /* Inner top highlight */
    inset 0 -1px 0 rgba(0,0,0,0.04);    /* Inner bottom depth */
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-top-color: rgba(255, 255, 255, 0.7); /* Brighter top edge = light direction */
}
```

**Hover enhancement:** deepen the shadow + apply `translateY(-1px)` to simulate the card lifting slightly off the surface.

---

### Expansion Animation Rhythm: Staggered Layers with Delay

Expansion animation should feel layered. Do not start every property at the same time:

1. **Width change first** (`duration-700`) — the card takes up space
2. **Height expansion follows** (`duration-700`) — the Grid content expands in sync with width
3. **Text fade-in comes later** (`duration-400, delay-150`) — the content appears only after the container is ready

This layering avoids the stiff feeling of "everything popping out at once."

---

### Easing Curve Choice

| Curve                         | Effect                                                   | Best Use Case                              |
| ----------------------------- | -------------------------------------------------------- | ------------------------------------------ |
| `ease-out`                    | Linear deceleration, somewhat mechanical                 | Simple transitions                         |
| `cubic-bezier(0.32,0.72,0,1)` | Fast start → natural deceleration, slightly elastic feel | Expand / collapse animations (recommended) |
| `ease-in-out`                 | Slow → fast → slow                                       | Looping animations                         |

```

---

### Flex Squeeze Artifact: Ghost Border Stripe on Collapsed Siblings

#### Problem

When one flex child expands via `hover:flex-[1_0_100%]`, the sibling cards get squeezed narrow. However, they never fully disappear — CSS flex layout preserves `min-width: auto` (the minimum content width), plus any `border`, `padding`, and `background` still render. The result is a thin **white stripe** at the edge where the sibling cards are crushed but still visible (a few pixels of border + white background + box-shadow).

#### Solution

Add explicit "disappear" styles to siblings using Tailwind's `group-hover` on the parent list:

```html
group-hover/list:flex-[0_0_0%]    <!-- force flex-basis to 0 -->
group-hover/list:opacity-0        <!-- make completely transparent -->
group-hover/list:border-transparent  <!-- hide border color -->
```

The hovered card itself overrides these with `!important`:

```html
hover:flex-[1_0_100%]!   <!-- take full width -->
hover:opacity-100!       <!-- stay fully visible -->
```

**Why this works:** `flex-[0_0_0%]` sets `flex-grow: 0, flex-shrink: 0, flex-basis: 0%`, which tells the browser "this item should occupy zero space." Combined with `opacity-0`, even if a few sub-pixel remnants exist, they are invisible.

#### Bonus: Separate Duration for Disappear vs Expand

The disappear animation should be **slower** than the expand animation to feel natural (the focus card opens quickly, while background cards fade out gently):

```html
transition-all duration-700 ease-[...]   <!-- base speed -->
group-hover/list:duration-1200           <!-- siblings disappear slowly -->
hover:duration-700!                      <!-- hovered card expands at normal speed -->
```

This works because:
1. When any card in the list is hovered, ALL cards receive `group-hover/list` styles, including the slower `duration-1200`
2. The actually-hovered card additionally matches `hover:`, and `hover:duration-700!` with `!important` overrides the group duration
3. Net result: hovered card = 700ms (expand), sibling cards = 1200ms (disappear)

---

### Elegant Sidebar Collapse Animation: Single DOM + Width Clipping

#### Problem

When animating a sidebar collapsing from a full view (e.g., 256px with text) to a rail view (e.g., 56px icons only), using conditional rendering (`if (isCollapsed) return <Rail/> else return <Full/>`) or crossfading two separate DOM trees causes ugly visual artifacts:
1. **Timing Mismatch:** The parent container smoothly animates its width over 300ms, but React instantly swaps the DOM nodes. This creates a huge temporary blank space inside the shrinking wrapper.
2. **Crossfade Ghosting:** Even if two separate DOM trees position an identical icon in the exact same coordinates, fading one out (`opacity 1→0`) while fading the other in (`opacity 0→1`) simultaneously creates a noticeable "dip" in opacity (flicker) due to alpha blending math.

#### Solution: Single Unified DOM

Instead of switching between two layouts, use a single fluid layout and leverage the parent container's width transition to physically clip the content.

```tsx
<!-- 1. Parent container controls the width transition -->
<aside className={`transition-all duration-300 overflow-hidden ${isCollapsed ? 'w-14' : 'w-64'}`}>

  <!-- 2. Single unified inner layout -->
  <div className="w-full flex flex-col whitespace-nowrap overflow-x-hidden">

    <button className="w-full flex items-center overflow-hidden">
      <!-- 3. The Anchor: Fixed size square with shrink-0 -->
      <div className="w-10 h-10 shrink-0 flex items-center justify-center">
        <Icon />
      </div>

      <!-- 4. The Tail: Text that fades out and gets clipped -->
      <div className={`min-w-[150px] transition-opacity duration-200 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
        <span>Text Content</span>
      </div>
    </button>

  </div>
</aside>
```

#### Key Techniques

1. **Rigid Anchors (`shrink-0`):** The left-side icons are wrapped in fixed-width containers (e.g., `w-10 shrink-0`). When the parent shrink to 56px, these icon wrappers refuse to compress, staying perfectly anchored to the left.
2. **Physical Clipping (`overflow-hidden` + `whitespace-nowrap`):** As the container narrows, the text on the right cannot wrap to a new line. It simply overflows its parent and is forcefully clipped by the moving right edge, acting exactly like a closing sliding door.
3. **Fade-out Masking (`opacity-0`):** To prevent the text from looking harshly "chopped" in half during the collapse, a faster `transition-opacity` (`duration-200` vs the wrapper's `duration-300`) smoothly fades it out. The text becomes invisible naturally just as the clipping door slides over it.

This approach perfectly replicates the silky, jump-free sidebar animations seen in modern advanced UIs like ChatGPT and Notion, with zero React render thrashing.

---

### Context-Aware Component Scaling (Sidebar Geometry Transition)

#### Problem

When building a collapsible sidebar (e.g., shrinking from a 256px expanded layout to a 56px collapsed rail), forcing the child elements to use the smallest common denominator size (e.g., using 40x40px rows and 32x32px avatars everywhere so they fit the collapsed rail) makes the expanded state look cramped, unbalanced, and visually unimpressive.

#### Solution: Synchronous Dimension Transitions

Do not compromise the expanded design. Instead, apply CSS transitions to the specific dimensions of the child components (`height`, `width`, `font-size`, `margin`, `border-radius`), triggered by the exact same boolean state (`isCollapsed`) and using the exact same `duration` and `easing` as the parent wrapper.

```tsx
<button className={`flex items-center w-full transition-all duration-300 ease-in-out
    ${isCollapsed ? 'h-10 rounded-lg' : 'h-[52px] rounded-xl'}`}>

    <div className="w-10 flex items-center justify-center shrink-0">
        <!-- Avatar scales smoothly in sync with the wrapper -->
        <Avatar className={`shrink-0 transition-all duration-300 ease-in-out
            ${isCollapsed ? 'h-8 w-8 rounded-lg' : 'h-10 w-10 rounded-xl'}`}>
            <AvatarImage src="..." />
        </Avatar>
    </div>

    <!-- Text fades out and adjusts its relative layout -->
    <div className={`flex flex-col min-w-[150px] transition-all duration-300 ease-in-out
        ${isCollapsed ? 'opacity-0 ml-2' : 'opacity-100 ml-3'}`}>
        <span className={`transition-all duration-300 ease-in-out
            ${isCollapsed ? 'text-[13.5px]' : 'text-sm'}`}>
            Character Name
        </span>
    </div>
</button>
```

#### Key Benefits & Techniques

1. **Perfect Proportions in Both States:** The expanded view remains generous and readable (52px row height, 40px avatars, larger text margins), while the collapsed view instantly and cleanly converts into a neat, squarified UI (40px row height, 32px avatars).
2. **"Breathing" Organism Effect:** As the sidebar drawer slides closed, the internal elements simultaneously shrink. Because the easing (`ease-in-out`) and duration (`300ms`) match the parent container's width animation perfectly, the elements appear to be reacting organically to spatial pressure rather than arbitrarily swapping sizes.
3. **Shape Consistency via Border Radius:** When scaling dimensions down dramatically (e.g., `48x40` rectangle down to `40x40` square), remember to also step down the `border-radius` (e.g., `rounded-xl` down to `rounded-lg`). Failing to do so can cause elements to look like pills rather than rounded boxes. Maintaining mathematical concentricity (Outer Radius = Inner Radius + Padding) across states prevents visual distortion.

---

### SVG Color Inheritance: `<Image>` vs Inline SVG

#### Problem

When using Next.js `<Image>` component to load SVG icons, `currentColor` does not work — the SVG cannot inherit the parent element's text color, even when the SVG file itself uses `fill="currentColor"`.

**Original code (broken):**
```tsx
<span className="text-[var(--cc-text-secondary)]">
  <Image src="/message-fill.svg" alt="" width={14} height={14} style={{ color: 'currentColor' }} />
  5.6k
</span>
```

The `currentColor` style on `<Image>` has no effect because Next.js renders SVG as an external `<img>` element, which is isolated from the parent DOM tree.

#### Root Cause

Next.js `<Image>` component renders SVG files as standalone `<img>` elements, similar to PNG or JPG images. The SVG document is loaded as a separate resource, completely isolated from the main page DOM. CSS `currentColor` inheritance requires the SVG to exist directly in the DOM tree so it can traverse up to find the parent's `color` property.

#### Solution: Inline SVG

Replace `<Image>` with inline SVG markup, using `fill="currentColor"` on the path elements:

```tsx
<span className="text-[var(--cc-text-secondary)]">
  <svg width="14" height="14" viewBox="0 0 1024 1024" style={{ color: 'currentColor' }}>
    <path d="..." fill="currentColor" />
  </svg>
  5.6k
</span>
```

#### Why It Works

| Approach | DOM Relationship | `currentColor` Works? |
|----------|-----------------|----------------------|
| `<img src="*.svg">` | External resource, isolated | ❌ No |
| `<Image src="*.svg">` | Rendered as `<img>`, isolated | ❌ No |
| **Inline `<svg>...</svg>`** | Directly in DOM tree | ✅ Yes |

Inline SVG exists directly in the page's DOM, so `currentColor` traverses up the element hierarchy to find the parent `<span>`'s `color` value.

#### Alternative Solutions

1. **SVGR webpack plugin** — Configure Next.js to import SVG as React components via `@svgr/webpack`
2. **CSS mask** — Use `background-color: currentColor` + `mask-image: url(*.svg)` to achieve color inheritance
3. **Filter hack** — `filter: invert() sepia() saturate() hue-rotate()` — but this is a workaround, not a real solution

---
### History Sidebar Active Highlight: Guard Against Stale Chat Responses

#### Problem

Sometimes the selected state in the chat history sidebar looks like “the light blue background just disappeared,” but the real problem is not necessarily the color style itself.

A typical scenario looks like this:

* Expected: the current chat item should have a light blue background, such as `bg-[#E5F3FF]`
* Actual: the row the user is viewing only has hover-state classes, and its computed background color is also transparent
* Symptom: it looks like the selected-state background is broken
* Reality: the main content area and the sidebar do not agree on which chat is the “current chat”

#### Root Cause

After the route has already switched to a new `chatId`, a late response from the previous chat’s `getChatTurns` request may still overwrite the current page’s `chat/messages` state.

This creates a very confusing mismatch:

1. The history sidebar uses the current route’s `chatId` to determine the active item
2. The main content area gets overwritten by the old chat’s response
3. The user sees content from A, but the sidebar highlights B
4. As a result, “the item I’m currently viewing” has no light blue background, making it look like the background is missing

This kind of issue is not caused by a wrong color token, nor by Tailwind class names failing to apply. It is **a stale response overwriting current route state**.

#### Diagnostic Signal

If a “selected-state background is missing” issue shows the following symptoms at the same time, suspect a request race condition before changing CSS:

* A row has no active class and only retains the hover class
* Another record in the same list has the active structure
* The current URL, the current page content, and the currently highlighted item do not match
* The issue is more likely to happen when switching chats, during initial load, or when an older request is slow

#### Correct Pattern

In any scenario where both the page content and the sidebar’s active highlight depend on the current route `chatId`, every async chat response must confirm that it still belongs to the current route before being applied.

```tsx
const activeChatIdRef = useRef(chatId);

useEffect(() => {
  activeChatIdRef.current = chatId;
}, [chatId]);

const data = await getChatTurns(chatId, { limit: 50 });

if (data.chat.id !== activeChatIdRef.current) {
  return;
}

applyTurnsPage(data);
```

The same protection should also cover:

* initial load in `loadChat`
* paginated loading in `loadOlderMessages`
* cleanup of `error` / `loading` state inside `catch/finally`

#### Rule of Thumb

* If the selected state depends on `item.id === activeId`, then old requests must not be allowed to overwrite the page content state for the page associated with that `activeId`
* For visual selected-state bugs, first verify whether the “current item resolution chain” is correct, then change colors and styles
* For chat views, detail pages, and master-detail structures, **the route is the source of truth, and async responses must stay aligned with the current route**

---

### Prevent Layout Jumps: Reserve Space Before Scrollbars or UI Chrome Appear

#### Problem

Some visual jank is not caused by the animation itself, but by an element that occupies geometric space suddenly appearing in a certain state:

* a scrollbar appears where there was none
* a border appears where there was none
* a panel, badge, action button, or auxiliary column appears where there was none
* an absolutely positioned element may look like a visual overlay, but its host container still changes the available width or height when the state changes

Typical symptoms include:

* the x / y anchor point shifts slightly before and after hover
* the motion looks like it “jumps” once and then continues
* the component’s position is not coded incorrectly, but the available layout space is inconsistent before and after the state change

#### Root Cause

As long as a state change modifies the container’s **available width / available height**, it will trigger reflow, causing visual anchor points that should have remained stable to shift.

The root cause of this kind of problem is usually not:

* the easing curve being wrong
* the transition duration being too short
* the transform being written incorrectly

The real cause is often:

* some geometric occupancy does not exist in state A but appears in state B
* the container uses different scrollbar / border / gutter / padding strategies in the two states

#### Correct Pattern

If an element will appear in a certain state and take up width or height, then that geometric space should already be reserved before the element actually appears.

Common approaches include:

* Scrollbars: keep the gutter even when hidden, and make the scrollbar transparent instead of changing its width to `0`
* Borders: preserve the same border width in the default state and only switch the border color
* Panels or auxiliary columns: reserve a fixed gutter in the default state, and only reveal the content when expanded without changing the rail’s anchor point
* Button or icon areas: preserve their size and layout slot in the default state, and hide them with `opacity` instead of `display: none`

For example, in a scrollbar scenario:

```css
.message-navigator-scroll {
  scrollbar-gutter: stable;
}

.message-navigator-scroll-collapsed {
  scrollbar-color: transparent transparent;
}

.message-navigator-scroll-collapsed::-webkit-scrollbar {
  width: 6px;
}

.message-navigator-scroll-collapsed::-webkit-scrollbar-thumb {
  background-color: transparent;
}
```

The key here is not “hide the scrollbar,” but “let the scrollbar continue occupying space while remaining visually invisible.”

#### Diagnostic Signal

If a component visually jumps before and after `hover` / `focus` / `expanded` / `active`, first check:

* whether `clientWidth` / `clientHeight` are consistent between the two states
* whether there is any `display: none -> block`
* whether there is any `border: 0 -> 1px`
* whether there is any `scrollbar-width: none -> thin`
* whether there is any `width: 0 -> auto`
* whether some hidden area only begins to occupy layout space after it appears

#### Rule of Thumb

* **Stabilize geometric space first, then think about visual transitions**
* If an element will occupy space after appearing, let it occupy that space before it appears
* If you can switch states with `opacity` / `color` / `background`, avoid using `display` / `width: 0` / `border: 0`
* When dealing with a “jumping” effect, check layout shift before tuning animation curves

---

### Message Navigator Highlight: Drive the Rail Directly from Scroll Position

#### Problem

If the highlight rail in a message navigator mixes several driving mechanisms at the same time, it will easily become visually inaccurate during fast scrolling or click-to-jump interactions:

* discrete `activeIndex` switching
* temporary locked state after clicking
* fixed-duration CSS transitions
* the browser’s own smooth scroll timing curve

Typical symptoms include:

* during fast scrolling, the first half of the highlight is barely visible
* it only becomes obvious suddenly when approaching the target and the scrolling slows down
* the rail looks like it is “chasing” the scroll instead of staying synchronized with the scroll position

#### Correct Pattern

Completely separate “click-based positioning” from “highlight rendering”:

* Click-based positioning should still calculate the target `scrollTop` using container geometry
* The highlight rail should no longer rely on time-based animation, but instead be derived directly from the current scroll position on every frame
* Use the position of the current activation line between two adjacent messages to calculate:

  * `activeIndex`
  * `fromIndex`
  * `toIndex`
  * `progress`
* The width, thickness, and color of each row’s rail should all be computed directly from that `progress`

```tsx
const targetTop =
  root.scrollTop +
  (elementRect.top - rootRect.top) -
  getHeaderOffset(root) -
  CLICK_SCROLL_TOP_GAP;

const progress = clamp(
  (activationLine - currentAnchor.messageMiddle) /
    (nextAnchor.messageMiddle - currentAnchor.messageMiddle),
  0,
  1
);
```

#### Why It Works

* The visual state of the rail becomes a direct function of the current scroll position, no longer affected by fixed transition durations
* Whether the user scrolls manually or the scroll is triggered programmatically after a click, the highlight always follows the current position
* Message positioning after clicking remains stable, and the header offset logic does not get broken by highlight experiments

#### Rule of Thumb

* **A scroll-linked highlight must be `style = f(scrollTop)`, not `style = f(time)`**
* The target coordinates for click-to-jump and the highlight animation are two separate layers of logic and should not be mixed together
* If a scroll highlight behaves very differently at different speeds, the first suspicion should be that it is still partially driven by time

---

### scrollIntoView Bubbles Through position:fixed — Use Manual scrollTop Instead

#### Problem

A `position: fixed` overlay component (e.g., a message navigator panel) contains a scrollable list of items. When `scrollIntoView({ block: "nearest" })` is called on an item inside this list, the component experiences **vertical jitter** — but only when the outer page scroll is being actively manipulated (e.g., by a "pin to bottom" auto-scroll loop).

The jitter does not happen all the time. It specifically requires:

1. The outer scroll root is being continuously scrolled (e.g., `pinToBottomUntilSettled` setting `root.scrollTop = root.scrollHeight` on every animation frame)
2. The fixed-position component expands (e.g., hover to show items)
3. `scrollIntoView` is called on an item inside the component

#### Root Cause

`scrollIntoView()` does **not** respect `position: fixed` as a scroll boundary. It walks up the **DOM tree** (not the visual stacking context) and attempts to scroll **every scrollable ancestor**, including containers that the fixed element is visually independent from.

If the fixed component is a DOM descendant of the page's scroll root (which is common — the component is rendered inside the page even though it's visually detached via `position: fixed`), then `scrollIntoView` will simultaneously:

1. Scroll the component's **internal** scroll container (desired)
2. Scroll the **outer page** scroll root (undesired)

When the outer scroll root is also being manipulated by auto-scroll logic (`pinToBottomUntilSettled`), these two competing scroll operations create a feedback loop:

```
scrollIntoView adjusts outer scrollTop
  → triggers scroll event
  → syncHighlightState recalculates activeIndex
  → activeIndex change triggers scrollIntoView again
  → repeat
```

This manifests as **vertical jitter** on the fixed component.

#### Why Naive Fixes Fail

| Attempted Fix | Why It Fails |
|---|---|
| Block scrollIntoView during expand transition (timer-based) | The jitter also occurs after the transition whenever auto-scroll is active (e.g., during streaming). The problem is not about the transition timing. |
| Block all passive scrollIntoView (only allow on user click/keyboard) | Fixes jitter but breaks the "follow active item" feature — the blue highlight rail can scroll out of the component's visible area without the component tracking it. |

#### Correct Fix: Manual `container.scrollTop` Adjustment

Replace `scrollIntoView()` with direct `scrollTop` manipulation on the component's own scroll container. This is guaranteed to only affect the target container and cannot propagate to any ancestor.

```tsx
const scrollContainerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const container = scrollContainerRef.current;
  const activeItem = navigationItems[highlightState.activeIndex];
  if (!container || !activeItem) return;

  const itemElement = itemRefs.current.get(activeItem.id);
  if (!itemElement) return;

  const containerRect = container.getBoundingClientRect();
  const itemRect = itemElement.getBoundingClientRect();

  if (itemRect.top < containerRect.top) {
    container.scrollTop += itemRect.top - containerRect.top;
  } else if (itemRect.bottom > containerRect.bottom) {
    container.scrollTop += itemRect.bottom - containerRect.bottom;
  }
}, [highlightState.activeIndex, navigationItems]);
```

This replicates `scrollIntoView({ block: "nearest" })` behavior but is scoped to exactly one container.

#### Diagnostic Signal

If a `position: fixed` component jitters when:

* It contains a scrollable area with `scrollIntoView` calls
* An ancestor in the DOM tree is also a scroll container
* That ancestor scroll container is being actively manipulated (auto-scroll, pin-to-bottom, infinite scroll)

Then the root cause is almost certainly `scrollIntoView` propagating to the ancestor scroll container.

#### Rule of Thumb

* **Never use `scrollIntoView` inside a `position: fixed` component that is a DOM descendant of another scroll container.** Use manual `container.scrollTop` adjustment instead.
* `position: fixed` only affects visual rendering (paint layer). It does **not** create a scroll boundary in the DOM tree. `scrollIntoView` follows DOM parentage, not visual stacking.
* When implementing "keep active item visible" in a scrollable list, prefer explicit `scrollTop` math over `scrollIntoView` — it gives full control over which container is affected and prevents cross-container interference.

---

### Narrow Separator on Glass/Frosted Background: Use `border`, Not `background-color`

#### Problem

When rendering a thin vertical divider (1-3px) inside a `backdrop-filter: blur()` glass header, using `background-color` on a `<div>` results in an invisible separator, even with seemingly visible colors like `bg-gray-500`.

Tested results on the same `h-4 w-0.5` element:

| Approach | Result |
|----------|--------|
| `<div className="h-4 w-0.5 bg-black" />` | Visible (high contrast) |
| `<div className="h-4 w-0.5 bg-black/30" />` | **Invisible** |
| `<div className="h-4 w-0.5 bg-gray-500" />` | **Invisible** |
| `<span className="inline-block h-4 border-l border-gray-500" />` | **Visible** |

#### Root Cause (Three Factors)

**1. Global `border-border` base style**

The project's `globals.css` applies `@apply border-border` to all elements:

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
}
```

This sets `border-color: var(--color-border)` = `oklch(0.92 0.004 286.32)` (near-white) on every element. This means:
- `border-l` with no explicit color uses this near-white default — invisible on glass
- `border-l border-gray-500` **overrides** it and works correctly
- This rule does **not** affect `background-color`, so it's not the direct cause of bg issues

**2. Browser subpixel rendering on narrow elements**

On Windows 11 (especially at 125%/150% DPI scaling), `background-color` on 1-3px wide elements is affected by subpixel anti-aliasing. Medium-to-low contrast colors (gray-500, black/30) get "anti-aliased away" and become invisible, while `border` is rendered by the browser's border engine with guaranteed pixel precision.

**3. shadcn Separator component overrides**

The shadcn Separator hardcodes `bg-border` (near-white) and `data-[orientation=vertical]:h-full`:
```tsx
className={cn(
  "shrink-0 bg-border data-[orientation=horizontal]:h-px ... data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
  className
)}
```
- `bg-border` = near-white, invisible on glass backgrounds
- `data-[orientation=vertical]:h-full` overrides user-provided `h-4` (tailwind-merge cannot resolve data-attribute variants vs plain classes)

#### Correct Pattern

```tsx
// Thin vertical separator on glass/frosted backgrounds
<span className="inline-block h-4 border-l border-gray-500" />
```

**Why this works:**
- `border-l` creates a left border rendered by the browser's border engine (pixel-precise)
- `border-gray-500` overrides the global `border-border` near-white default
- `inline-block` allows width/height control on the span

**Avoid:**
```tsx
// These will be invisible on glass backgrounds
<div className="h-4 w-0.5 bg-gray-500" />
<div className="h-4 w-px bg-gray-400" />
<Separator orientation="vertical" className="h-4 bg-gray-400" />
```

#### Rule of Thumb

- On `backdrop-filter` glass/frosted surfaces, use `border` for thin separators, not `background-color`
- The global `@layer base { * { @apply border-border } }` means `border-l` without explicit color uses near-white — always specify border color explicitly
- shadcn Separator component's internal styles override both height and color; prefer a plain `<span>` with `border-l` for custom separators

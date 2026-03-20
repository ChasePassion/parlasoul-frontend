# Role Card 重构方案

> 状态：规划中
> 创建时间：2026-03-20
> 目标：将 CharacterCard 组件重构为动态毛玻璃设计风格

---

## 1. 现状分析

### 1.1 现有实现

**文件位置**：`src/components/CharacterCard.tsx`

**当前设计特点**：
- 传统白底卡片，固定尺寸 404px × 200px
- 左右布局：左侧 35% 头像区，右侧 65% 内容区
- 在线状态指示器（绿点脉冲动画）
- 彩色标签 Badge（蓝/粉/紫/青/琥珀/绿）
- 悬停效果：上移 4px + 阴影加深
- 菜单功能：编辑/删除操作

**使用位置**：
| 页面 | 文件路径 | 用途 |
|------|----------|------|
| 发现页 | `src/app/(app)/page.tsx` | 展示所有角色卡片 |
| 个人资料页 | `src/app/(app)/profile/page.tsx` | 展示用户创建的角色 |

**Props 接口**：
```typescript
interface CharacterCardProps {
    character: Character;
    onClick: (character: Character) => void;
    showMenu?: boolean;      // 是否显示菜单（个人资料页需要）
    onEdit?: (character: Character) => void;
    onDelete?: (character: Character) => void;
}
```

---

## 2. 目标设计

### 2.1 设计规格（来自 `example/role-card.md`）

**视觉概念**：悬浮的"动态智能视窗"

**四层结构**：
| 层级 | 名称 | 实现方式 |
|------|------|----------|
| 底层 | 动态模糊背景 | 头像图片 `scale(1.1)` + `blur(24px)` |
| 中层 | 暗色玻璃遮罩 | `rgba(10, 10, 15, 0.5)` + 微弱渐变 |
| 上层 | 内容层 | 头像 + 文字信息 |
| 顶层 | 微切角标签 | `rgba(0, 0, 0, 0.35)` 半透明黑底 |

**尺寸变化**：
| 属性 | 旧值 | 新值 |
|------|------|------|
| 高度 | 200px | 150px |
| 宽度 | 404px (固定) | 响应式 `minmax(380px, 1fr)` |
| 圆角 | 16px | 20px |

**字体层级**：
| 元素 | 字号 | 颜色/透明度 |
|------|------|------------|
| 角色名 | 18px / 700 | `#ffffff` |
| 数据指标 | 13px / 500 | `rgba(255,255,255,0.6)` |
| 描述 | 13px / normal | `rgba(255,255,255,0.85)` + 截断2行 |
| 标签 | 11px / 600 | `rgba(255,255,255,0.9)` |

**微交互**：
- 静止：柔和弥散阴影 `box-shadow: 0 12px 32px rgba(0,0,0,0.08)`
- 悬停：上移 6px + 阴影加深 + 边缘高光变亮

---

## 3. 重构计划

### 3.1 Phase 1：组件重构

**目标文件**：`src/components/CharacterCard.tsx`

**改造要点**：

#### 3.1.1 结构调整
```
旧结构：
┌────────────────────────────────────┐
│ ┌──────────┐ │ ┌────────────────────┐││
│ │Avatar 35%│ │ │ Name + Stats       ││
│ │          │ │ │ Tags               ││
│ │          │ │ │ Description        ││
│ │Online Dot│ │ │ Footer             ││
│ └──────────┘ │ └────────────────────┘│
└────────────────────────────────────┘

新结构：
┌────────────────────────────────────┐
│ [Blurred Avatar BG - Layer 1]      │
│ [Dark Glass Overlay - Layer 2]     │
│ [Content Layer 3]:                  │
│ ┌────────┐ ┌─────────────────────┐ │
│ │Avatar  │ │ Name         Stats  │ │
│ │        │ │ Description (2行)   │ │
│ │        │ │ [Tag] [Tag]        │ │
│ └────────┘ └─────────────────────┘ │
└────────────────────────────────────┘
```

#### 3.1.2 样式迁移（CSS-in-JS → Tailwind）

**关键样式类名**：
```css
.glass-card      /* 卡片容器 */
.glass-bg        /* 底层模糊背景 */
.glass-overlay   /* 中层玻璃遮罩 */
.glass-content   /* 上层内容容器 */
.card-avatar     /* 头像样式 */
.card-info       /* 文字信息容器 */
.card-header     /* 头部（名字+指标） */
.card-name       /* 角色名 */
.card-stats      /* 数据指标 */
.card-desc       /* 描述（2行截断）*/
.card-tags       /* 标签容器 */
.tag             /* 单个标签 */
```

#### 3.1.3 功能保留

| 功能 | 状态 | 说明 |
|------|------|------|
| 点击跳转聊天 | ✅ 保留 | `onClick` prop |
| 编辑/删除菜单 | ✅ 保留 | `showMenu`, `onEdit`, `onDelete` |
| 在线状态 | ⚠️ 需确认 | 原设计无此元素，需决定是否保留 |
| 标签颜色 | ❌ 移除 | 统一半透明黑底白字 |

### 3.2 Phase 2：使用页面调整

**涉及文件**：
1. `src/app/(app)/page.tsx` - 发现页
2. `src/app/(app)/profile/page.tsx` - 个人资料页

**调整内容**：
- 卡片容器从 `flex flex-wrap gap-6` 改为 `grid` 布局
- 响应式断点适配

```tsx
// 旧布局
<div className="mt-8 flex flex-wrap gap-6">

// 新布局
<div className="card-grid">
// CSS:
.card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
    gap: 28px;
}
```

---

## 4. 技术实现细节

### 4.1 核心组件代码

```tsx
// CharacterCard.tsx - 重构后结构
export default function CharacterCard({
    character,
    onClick,
    showMenu = false,
    onEdit,
    onDelete
}: CharacterCardProps) {
    return (
        <div
            onClick={() => onClick(character)}
            className="group relative block h-[150px] rounded-[20px] overflow-hidden cursor-pointer"
            style={{
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.08)',
                border: '1px solid rgba(0, 0, 0, 0.04)',
                transition: 'all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)'
            }}
        >
            {/* Layer 1: 模糊背景 */}
            <div
                className="absolute inset-[-30px] z-[1]"
                style={{
                    backgroundImage: `url(${character.avatar})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    filter: 'blur(24px)',
                    transform: 'scale(1.1)'
                }}
            />

            {/* Layer 2: 玻璃遮罩 */}
            <div
                className="absolute inset-0 z-[2] rounded-[20px]"
                style={{
                    backgroundColor: 'rgba(10, 10, 15, 0.5)',
                    backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.15)'
                }}
            />

            {/* Layer 3: 内容 */}
            <div className="relative z-[3] flex h-full p-4 gap-[18px]">
                {/* 头像 */}
                <Image
                    src={character.avatar}
                    alt={character.name}
                    width={118}
                    height={118}
                    className="h-full w-auto rounded-[14px] object-cover"
                    style={{
                        boxShadow: '0 6px 16px rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                />

                {/* 信息区 */}
                <div className="flex-1 flex flex-col justify-center min-w-0">
                    <div className="flex justify-between items-center mb-1.5 gap-3">
                        <h3 className="text-lg font-bold text-white truncate">
                            {character.name}
                        </h3>
                        <span className="text-[13px] text-white/60 shrink-0">
                            💬 5.6k
                        </span>
                    </div>
                    <p className="text-[13px] text-white/85 leading-[1.5] line-clamp-2 mb-3">
                        {character.description}
                    </p>
                    <div className="flex gap-2">
                        {character.tags?.map((tag, i) => (
                            <span
                                key={i}
                                className="text-[11px] font-semibold px-2.5 py-1 rounded-md"
                                style={{
                                    backgroundColor: 'rgba(0, 0, 0, 0.35)',
                                    color: 'rgba(255, 255, 255, 0.9)',
                                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)'
                                }}
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* 悬停效果 */}
            <style jsx>{`
                .group:hover {
                    transform: translateY(-6px);
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12);
                }
            `}</style>
        </div>
    );
}
```

### 4.2 全局样式（建议添加到 globals.css）

```css
/* 角色卡片网格容器 */
.card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
    gap: 28px;
    width: 100%;
    max-width: 1200px;
    align-content: start;
}

/* 响应式调整 */
@media (max-width: 768px) {
    .card-grid {
        grid-template-columns: 1fr;
    }
}
```

---

## 5. 需要决策的问题

### 5.1 在线状态指示器
- **现状**：绿点 + "Online" 文字
- **新设计**：无此元素
- **建议**：移除（保持设计纯净）

### 5.2 数据指标来源
- **现状**：硬编码 "5.6k人正在聊"
- **建议**：保持占位

### 5.3 标签颜色系统
- **现状**：多彩 Badge
- **新设计**：统一半透明黑底
- **建议**：按新设计实现

---

## 6. 执行步骤

### Step 1：备份现有组件
```bash
cp src/components/CharacterCard.tsx src/components/CharacterCard.tsx.bak
```

### Step 2：重构 CharacterCard 组件
- 移除旧的 class样式
- 实现四层结构
- 调整尺寸比例
- 更新标签样式

### Step 3：更新使用页面布局
- 修改 layout 容器为 grid
- 添加响应式样式

### Step 4：测试验证
- 视觉回归测试
- 交互测试（点击、悬停、菜单）
- 响应式测试（不同屏幕尺寸）

### Step 5：清理备份
```bash
rm src/components/CharacterCard.tsx.bak
```

---

## 7. 风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| 图片加载性能 | 中 | 模糊背景需要加载完整图片，考虑 lazy loading |
| 深色背景上的可读性 | 低 | 暗色遮罩层已确保白色文字清晰 |
| 响应式兼容 | 低 | Grid 布局已考虑子768px 断点 |
| 功能回归 | 低 | Props 接口保持不变 |

---

## 8. 验收标准

- [ ] 卡片视觉符合设计稿（四层结构、毛玻璃效果）
- [ ] 悬停动画流畅（cubic-bezier 曲线）
- [ ] 标签样式正确（半透明黑底、微切角）
- [ ] 描述文字2行截断正常
- [ ] 点击/编辑/删除功能正常
- [ ] 响应式布局适配（360px - 1920px）
- [ ] 无 TypeScript 错误
- [ ] 无控制台错误

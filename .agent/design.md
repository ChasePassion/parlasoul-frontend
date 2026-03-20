# Design Knowledge

This is an AI role-playing English learning website aimed at consumers. Users can create characters on the platform and talk with them, learning music during the conversations.

## DropdownMenu (shadcn) sideOffset Behavior

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

## Input Component: `focus` vs `focus-visible`

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

## Input Component: `::selection` with `bg-transparent`

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

## Text Selection Overlay: Avoid React State for Selection Buttons

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

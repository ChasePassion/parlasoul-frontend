export interface CardBox {
  width: number;
  height: number;
}

export interface ViewportBox {
  width: number;
  height: number;
}

export interface HoleBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CardPosition {
  x: number;
  y: number;
  side: "top" | "bottom";
  arrowLeft: number;
}

const GAP = 12;
const PADDING = 16;

/**
 * 依据聚光灯矩形计算卡片位置。输入必须来自真实可见的目标元素，
 * 否则算出来的坐标仍然合法但没有意义，因此调用方需要先过滤无效矩形。
 */
export function computeCardPosition(
  hole: HoleBox,
  card: CardBox,
  viewport: ViewportBox,
  placement = "bottom",
): CardPosition | null {
  if (
    card.width <= 0 ||
    card.height <= 0 ||
    viewport.width <= 0 ||
    viewport.height <= 0 ||
    hole.width <= 0 ||
    hole.height <= 0 ||
    card.width > viewport.width - PADDING * 2
  ) {
    return null;
  }

  const [rawSide, rawAlign] = placement.split("-");
  const baseSide: "top" | "bottom" = rawSide === "top" ? "top" : "bottom";
  const align = rawAlign ?? "center";

  const topFor = (side: "top" | "bottom") =>
    side === "top"
      ? hole.y - GAP - card.height
      : hole.y + hole.height + GAP;

  let side = baseSide;
  let top = topFor(side);

  if (top < PADDING) {
    side = "bottom";
    top = topFor("bottom");
  } else if (top + card.height > viewport.height - PADDING) {
    side = "top";
    top = topFor("top");
  }

  top = Math.max(PADDING, Math.min(viewport.height - PADDING - card.height, top));

  let left =
    align === "start"
      ? hole.x
      : align === "end"
        ? hole.x + hole.width - card.width
        : hole.x + hole.width / 2 - card.width / 2;
  left = Math.max(
    PADDING,
    Math.min(viewport.width - PADDING - card.width, left),
  );

  return {
    x: left,
    y: top,
    side,
    arrowLeft: Math.max(
      16,
      Math.min(
        card.width - 26,
        hole.x + hole.width / 2 - left - 5,
      ),
    ),
  };
}

import { useEffect, useRef, useState } from "react";
import { LOADING_TIMING } from "@/lib/loading";

/**
 * 把"是否正在等待"转换成"是否应该显示指示器"。
 * 延迟出现避免快响应闪烁；一旦出现，保持最短展示时长避免一闪而过。
 * 全站共用这一套时序，不允许各页面自己写 setTimeout。
 */
export function useDelayedLoading(isPending: boolean): {
  showIndicator: boolean;
  showAcknowledgement: boolean;
} {
  const [showIndicator, setShowIndicator] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const shownAtRef = useRef<number | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isPending) {
      if (startedAtRef.current === null) {
        startedAtRef.current = Date.now();
      }
      const delayTimer = setTimeout(() => {
        if (startedAtRef.current === null) return;
        shownAtRef.current = Date.now();
        setShowIndicator(true);
      }, LOADING_TIMING.indicatorDelayMs);
      return () => clearTimeout(delayTimer);
    }

    startedAtRef.current = null;
    if (shownAtRef.current === null) {
      setShowIndicator(false);
      return;
    }
    const elapsed = Date.now() - shownAtRef.current;
    const remaining = Math.max(0, LOADING_TIMING.minVisibleMs - elapsed);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      shownAtRef.current = null;
      setShowIndicator(false);
    }, remaining);
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [isPending]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  return {
    showIndicator,
    // 确认态立即给出（由调用方渲染在被点元素上），不需要等延迟
    showAcknowledgement: isPending,
  };
}

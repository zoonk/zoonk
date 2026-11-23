"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const PHONE_CONTENT_WIDTH = 318;

export function useMeasuredWidth<TElement extends HTMLElement>(
  fallback = PHONE_CONTENT_WIDTH,
  { measureBeforePaint = false }: { measureBeforePaint?: boolean } = {},
) {
  const ref = useRef<TElement>(null);
  const [width, setWidth] = useState(fallback);

  const updateWidth = useCallback((contentWidth: number) => {
    const next = Math.round(contentWidth);

    if (next > 0) {
      setWidth(next);
    }
  }, []);

  useLayoutEffect(() => {
    const element = ref.current;

    if (!measureBeforePaint || !element) {
      return;
    }

    const { paddingLeft, paddingRight } = getComputedStyle(element);

    const paddingWidth =
      Number(paddingLeft.replace("px", "")) + Number(paddingRight.replace("px", ""));

    updateWidth(element.clientWidth - paddingWidth);
  }, [measureBeforePaint, updateWidth]);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => updateWidth(entry?.contentRect.width ?? 0));

    observer.observe(element);
    return () => observer.disconnect();
  }, [updateWidth]);

  return { ref, width };
}

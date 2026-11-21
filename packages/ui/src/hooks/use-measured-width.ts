"use client";

import { useLayoutEffect, useRef, useState } from "react";

export function useMeasuredWidth<TElement extends HTMLElement>(fallback: number) {
  const ref = useRef<TElement>(null);
  const [width, setWidth] = useState(fallback);

  useLayoutEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    function updateWidth(contentWidth: number) {
      const next = Math.round(contentWidth);

      if (next > 0) {
        setWidth(next);
      }
    }

    const { paddingLeft, paddingRight } = getComputedStyle(element);

    const paddingWidth =
      Number(paddingLeft.replace("px", "")) + Number(paddingRight.replace("px", ""));

    updateWidth(element.clientWidth - paddingWidth);

    const observer = new ResizeObserver(([entry]) => updateWidth(entry?.contentRect.width ?? 0));

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

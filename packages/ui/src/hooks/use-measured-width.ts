"use client";

import { useEffect, useRef, useState } from "react";

const PHONE_CONTENT_WIDTH = 318;

export function useMeasuredWidth<TElement extends HTMLElement>(fallback = PHONE_CONTENT_WIDTH) {
  const ref = useRef<TElement>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry?.contentRect.width ?? 0);

      if (next > 0) {
        setWidth(next);
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

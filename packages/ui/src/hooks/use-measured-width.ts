"use client";

import { useEffect, useRef, useState } from "react";

export function useMeasuredWidth<TElement extends HTMLElement>(fallback: number) {
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

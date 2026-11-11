"use client";

import { type RefObject, useEffect, useState } from "react";

export const LABEL_FONT_SIZE = 12;

/**
 * Charts are laid out for 12px labels. A larger browser text size scales the whole drawing, the way
 * zoom does, so names and numbers keep the room the layout gave them.
 */
export function useTextScale(ref: RefObject<HTMLElement | null>): number {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (ref.current) {
      setScale(Number(getComputedStyle(ref.current).fontSize.replace("px", "")) / LABEL_FONT_SIZE);
    }
  }, [ref]);

  return scale;
}

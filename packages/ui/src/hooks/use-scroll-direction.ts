"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ScrollDirection = "up" | "down" | null;

type UseScrollDirectionOptions = {
  /** Threshold in pixels before detecting direction change */
  threshold?: number;
  /** Initial direction (null means not scrolled yet) */
  initialDirection?: ScrollDirection;
};

type UseScrollDirectionReturn = {
  scrollDirection: ScrollDirection;
  isAtTop: boolean;
};

/**
 * Hook to detect scroll direction for hiding/showing UI elements.
 * Returns the scroll direction ("up" or "down") and whether we're at the top.
 */
export function useScrollDirection(
  options: UseScrollDirectionOptions = {},
): UseScrollDirectionReturn {
  const { threshold = 10, initialDirection = null } = options;

  const [scrollDirection, setScrollDirection] =
    useState<ScrollDirection>(initialDirection);
  const [isAtTop, setIsAtTop] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  const updateScrollDirection = useCallback(() => {
    const scrollY = window.scrollY;

    setIsAtTop(scrollY < threshold);

    if (Math.abs(scrollY - lastScrollY.current) < threshold) {
      ticking.current = false;
      return;
    }

    const direction = scrollY > lastScrollY.current ? "down" : "up";
    setScrollDirection(direction);
    lastScrollY.current = scrollY;
    ticking.current = false;
  }, [threshold]);

  useEffect(() => {
    const onScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(updateScrollDirection);
        ticking.current = true;
      }
    };

    lastScrollY.current = window.scrollY;
    setIsAtTop(window.scrollY < threshold);

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold, updateScrollDirection]);

  return { isAtTop, scrollDirection };
}

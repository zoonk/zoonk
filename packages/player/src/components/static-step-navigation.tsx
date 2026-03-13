"use client";

import { useRef } from "react";

const SWIPE_MIN_DISTANCE = 50;
const SWIPE_MAX_VERTICAL_DRIFT = 75;

export function useSwipeNavigation({
  canNavigatePrev,
  onNavigateNext,
  onNavigatePrev,
}: {
  canNavigatePrev: boolean;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
}) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];

    if (!touch) {
      return;
    }

    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const start = touchStart.current;
    const touch = event.changedTouches[0];

    touchStart.current = null;

    if (!start || !touch) {
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = Math.abs(touch.clientY - start.y);

    if (Math.abs(deltaX) < SWIPE_MIN_DISTANCE || deltaY > SWIPE_MAX_VERTICAL_DRIFT) {
      return;
    }

    if (deltaX < 0) {
      onNavigateNext();
      return;
    }

    if (canNavigatePrev) {
      onNavigatePrev();
    }
  };

  return {
    onTouchEnd: handleTouchEnd,
    onTouchStart: handleTouchStart,
  };
}

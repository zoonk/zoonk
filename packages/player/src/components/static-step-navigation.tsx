"use client";

import { useRef } from "react";

const SWIPE_MIN_DISTANCE = 50;
const SWIPE_MAX_VERTICAL_DRIFT = 75;
const SWIPE_TAP_SUPPRESSION_MS = 400;

export function StaticTapZones({
  isFirst,
  onNavigateNext,
  onNavigatePrev,
}: {
  isFirst: boolean;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
}) {
  return (
    <div aria-hidden="true">
      {!isFirst && (
        <button
          className="absolute inset-y-0 left-0 z-10 w-1/3 active:opacity-92 pointer-fine:cursor-pointer"
          onClick={onNavigatePrev}
          tabIndex={-1}
          type="button"
        />
      )}

      <button
        className="absolute inset-y-0 right-0 z-10 w-2/3 active:opacity-92 pointer-fine:cursor-pointer"
        onClick={onNavigateNext}
        tabIndex={-1}
        type="button"
      />
    </div>
  );
}

export function useStaticStepNavigation({
  isFirst,
  onNavigateNext,
  onNavigatePrev,
}: {
  isFirst: boolean;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
}) {
  const lastSwipeAt = useRef<number | null>(null);
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

    lastSwipeAt.current = Date.now();

    if (deltaX < 0) {
      onNavigateNext();
      return;
    }

    if (!isFirst) {
      onNavigatePrev();
    }
  };

  const shouldIgnoreTap = () =>
    lastSwipeAt.current !== null && Date.now() - lastSwipeAt.current < SWIPE_TAP_SUPPRESSION_MS;

  const handleNavigateNextTap = () => {
    if (shouldIgnoreTap()) {
      return;
    }

    onNavigateNext();
  };

  const handleNavigatePrevTap = () => {
    if (shouldIgnoreTap()) {
      return;
    }

    onNavigatePrev();
  };

  return {
    onNavigateNextTap: handleNavigateNextTap,
    onNavigatePrevTap: handleNavigatePrevTap,
    swipeHandlers: {
      onTouchEnd: handleTouchEnd,
      onTouchStart: handleTouchStart,
    },
  };
}

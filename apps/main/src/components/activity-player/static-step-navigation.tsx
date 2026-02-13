"use client";

import { useRef } from "react";

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

const SWIPE_MIN_DISTANCE = 50;
const SWIPE_MAX_VERTICAL_DRIFT = 75;

export function useSwipeNavigation({
  onNavigateNext,
  onNavigatePrev,
}: {
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
}) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];

    if (touch) {
      touchStart.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current;
    const touch = event.changedTouches[0];

    if (!start || !touch) {
      return;
    }

    touchStart.current = null;

    const deltaX = touch.clientX - start.x;
    const deltaY = Math.abs(touch.clientY - start.y);

    if (Math.abs(deltaX) < SWIPE_MIN_DISTANCE || deltaY > SWIPE_MAX_VERTICAL_DRIFT) {
      return;
    }

    if (deltaX < 0) {
      onNavigateNext();
    } else {
      onNavigatePrev();
    }
  };

  return { onTouchEnd: handleTouchEnd, onTouchStart: handleTouchStart };
}

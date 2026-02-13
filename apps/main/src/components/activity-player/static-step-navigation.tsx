"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useExtracted } from "next-intl";
import { useRef } from "react";

export function StaticTapZones({
  isFirst,
  isLast,
  onNavigateNext,
  onNavigatePrev,
}: {
  isFirst: boolean;
  isLast: boolean;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
}) {
  const t = useExtracted();

  return (
    <>
      {!isFirst && (
        <button
          aria-label={t("Previous step")}
          className="absolute inset-y-0 left-0 z-10 w-1/3 active:opacity-92 pointer-fine:cursor-pointer"
          onClick={onNavigatePrev}
          type="button"
        />
      )}

      <button
        aria-label={isLast ? t("Complete activity") : t("Next step")}
        className="absolute inset-y-0 right-0 z-10 w-2/3 active:opacity-92 pointer-fine:cursor-pointer"
        onClick={onNavigateNext}
        type="button"
      />
    </>
  );
}

export function StaticEdgeChevrons({ isFirst, isLast }: { isFirst: boolean; isLast: boolean }) {
  return (
    <>
      {!isFirst && (
        <div
          aria-hidden="true"
          className="group/left pointer-events-none absolute inset-y-0 left-0 z-20 w-20 pointer-coarse:hidden"
        >
          <div
            className={cn(
              "border-border bg-background",
              "absolute top-1/2 left-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm",
              "opacity-0 transition-opacity duration-200 group-hover/left:opacity-100",
              "motion-reduce:transition-none",
            )}
          >
            <ChevronLeft className="text-muted-foreground size-4" />
          </div>
        </div>
      )}

      {!isLast && (
        <div
          aria-hidden="true"
          className="group/right pointer-events-none absolute inset-y-0 right-0 z-20 w-20 pointer-coarse:hidden"
        >
          <div
            className={cn(
              "border-border bg-background",
              "absolute top-1/2 right-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm",
              "opacity-0 transition-opacity duration-200 group-hover/right:opacity-100",
              "motion-reduce:transition-none",
            )}
          >
            <ChevronRight className="text-muted-foreground size-4" />
          </div>
        </div>
      )}
    </>
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

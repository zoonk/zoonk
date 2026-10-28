"use client";

import { type RefObject, useEffect, useEffectEvent } from "react";

const SWIPE_DISTANCE = 48;

const SWIPE_RATIO = 1.2;

const SWIPE_MAX_MS = 800;

const ZOOMED_SCALE = 1.01;

const INTERACTIVE_SELECTOR = [
  "a",
  "audio",
  "button:not(:disabled)",
  "input:not(:disabled)",
  "label",
  "select:not(:disabled)",
  "summary",
  "textarea:not(:disabled)",
  "video",
  "[contenteditable='true']",
  "[draggable='true']",
  "[role='button']",
  "[role='link']",
  "[role='slider']",
].join(",");

type Gesture = { id: number; startedAt: number; x: number; y: number };

const BROWSER_TOUCH_ACTIONS = new Set(["auto", "manipulation"]);

function handlesOwnTouch(element: Element): boolean {
  const { overflowX, touchAction } = getComputedStyle(element);

  const scrollsSideways =
    element.scrollWidth > element.clientWidth && (overflowX === "auto" || overflowX === "scroll");

  return scrollsSideways || !BROWSER_TOUCH_ACTIONS.has(touchAction);
}

function startsOnOwnGesture(target: EventTarget | null, boundary: Element): boolean {
  if (!(target instanceof Element) || target.closest(INTERACTIVE_SELECTOR)) {
    return true;
  }

  for (let element: Element | null = target; element && element !== boundary;) {
    if (handlesOwnTouch(element)) {
      return true;
    }

    element = element.parentElement;
  }

  return false;
}

function isZoomed(): boolean {
  return (globalThis.visualViewport?.scale ?? 1) > ZOOMED_SCALE;
}

function findTouch(touches: TouchList, id: number): Touch | null {
  return [...touches].find((touch) => touch.identifier === id) ?? null;
}

export function useSwipeNavigation({
  onBack,
  onForward,
  ref,
}: {
  onBack: () => void;
  onForward: () => void;
  ref: RefObject<HTMLElement | null>;
}) {
  const turnBack = useEffectEvent(onBack);
  const turnForward = useEffectEvent(onForward);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    let gesture: Gesture | null = null;

    const handleEnd = (event: TouchEvent) => {
      const start = gesture;
      const touch = start ? findTouch(event.changedTouches, start.id) : null;

      if (!start || !touch) {
        return;
      }

      gesture = null;

      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;

      const isSwipe =
        Math.abs(deltaX) > SWIPE_DISTANCE &&
        Math.abs(deltaX) > Math.abs(deltaY) * SWIPE_RATIO &&
        event.timeStamp - start.startedAt < SWIPE_MAX_MS &&
        !isZoomed();

      if (!isSwipe) {
        return;
      }

      if (deltaX < 0) {
        turnForward();
      } else {
        turnBack();
      }
    };

    const handleCancel = () => {
      gesture = null;
    };

    const handleStart = (event: TouchEvent) => {
      const touch = event.touches.length === 1 ? event.touches.item(0) : null;

      gesture =
        touch && !isZoomed() && !startsOnOwnGesture(event.target, element)
          ? { id: touch.identifier, startedAt: event.timeStamp, x: touch.clientX, y: touch.clientY }
          : null;
    };

    element.addEventListener("touchstart", handleStart, { passive: true });
    globalThis.addEventListener("touchend", handleEnd, { passive: true });
    globalThis.addEventListener("touchcancel", handleCancel, { passive: true });

    return () => {
      element.removeEventListener("touchstart", handleStart);
      globalThis.removeEventListener("touchend", handleEnd);
      globalThis.removeEventListener("touchcancel", handleCancel);
    };
  }, [ref]);
}

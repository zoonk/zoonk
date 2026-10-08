"use client";

import { type RefObject, useEffect, useEffectEvent } from "react";

/** How far a finger travels sideways before a swipe turns the screen. */
const SWIPE_DISTANCE = 48;

/** Sideways must win clearly over up and down, so scrolling a long screen never turns it. */
const SWIPE_RATIO = 1.2;

/** A swipe is a quick flick; a finger that rests first is selecting text or scrolling. */
const SWIPE_MAX_MS = 800;

const ZOOMED_SCALE = 1.01;

/** Controls keep their own touch: tapping, dragging or sliding them never turns the screen. */
const INTERACTIVE_SELECTOR = [
  "a",
  "audio",
  "button",
  "input",
  "label",
  "select",
  "summary",
  "textarea",
  "video",
  "[contenteditable='true']",
  "[draggable='true']",
  "[role='button']",
  "[role='link']",
  "[role='slider']",
].join(",");

type Gesture = { id: number; startedAt: number; x: number; y: number };

/** Touch handling a page leaves to the browser: anything else, an element handles itself. */
const BROWSER_TOUCH_ACTIONS = new Set(["auto", "manipulation"]);

/**
 * Content that scrolls sideways (a wide table, a line of code) scrolls under the finger, and an
 * element that handles touch itself (a handle to drag, a dial to turn) keeps it.
 */
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

/** Pinch-zoomed in, a finger pans the page to look closer, so it never turns the screen. */
function isZoomed(): boolean {
  return (globalThis.visualViewport?.scale ?? 1) > ZOOMED_SCALE;
}

function findTouch(touches: TouchList, id: number): Touch | null {
  return [...touches].find((touch) => touch.identifier === id) ?? null;
}

/**
 * Story-like screen turns on a touch screen: a quick swipe left moves to the next screen and a
 * swipe right goes back, exactly where the arrow keys do. The swipe is read when the finger lifts
 * (the content never follows the finger), anywhere on the screen except on controls and content
 * that scrolls sideways, and never while the page is zoomed in. Mice and keyboards are untouched.
 *
 * ```ts
 * useSwipeNavigation({ onBack, onForward, ref: mainRef });
 * ```
 */
export function useSwipeNavigation({
  onBack,
  onForward,
  ref,
}: {
  /** A swipe right: goes back a screen when the learner can. */
  onBack: () => void;
  /** A swipe left: moves to the next screen when the learner can. */
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

    // A fast swipe can lift outside the screen, so its end is read from the whole window.
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
        Date.now() - start.startedAt < SWIPE_MAX_MS &&
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
          ? { id: touch.identifier, startedAt: Date.now(), x: touch.clientX, y: touch.clientY }
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

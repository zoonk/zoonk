"use client";

import { type TouchEvent, useEffect, useRef } from "react";
import { NavigableStepLayout } from "./step-layouts";

const SWIPE_DISTANCE_THRESHOLD = 48;
const SWIPE_HORIZONTAL_RATIO = 1.05;
const TAP_DISTANCE_THRESHOLD = 12;

type SwipeGesture = {
  container: HTMLDivElement;
  startX: number;
  startY: number;
  touchId: number;
};

/**
 * Buttons, links, and other controls should keep their native tap behavior.
 * The swipe layer only owns empty read-scene space so it does not steal
 * gestures from interactive descendants like the vocabulary audio button.
 */
function isInteractiveSwipeTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest(
      [
        "a",
        "audio",
        "button",
        "input",
        "label",
        "select",
        "summary",
        "textarea",
        "[contenteditable='true']",
        "[role='button']",
        "[role='link']",
      ].join(","),
    ),
  );
}

/**
 * Read-only steps need a clear horizontal intent before they navigate.
 * Requiring a wider X delta than Y delta prevents accidental page turns from
 * diagonal drags or slight finger jitter while the user is reading.
 */
function isHorizontalSwipe({ deltaX, deltaY }: { deltaX: number; deltaY: number }) {
  return (
    Math.abs(deltaX) > SWIPE_DISTANCE_THRESHOLD &&
    Math.abs(deltaX) > Math.abs(deltaY) * SWIPE_HORIZONTAL_RATIO
  );
}

/**
 * Touch-friendly read steps should also support single-tap navigation so users
 * can move through content with one hand. Using the left/right half split keeps
 * the interaction simple and avoids adding visible controls back into the UI.
 */
function runTapNavigation({
  canNavigatePrev,
  container,
  clientX,
  onNavigateNext,
  onNavigatePrev,
}: {
  canNavigatePrev: boolean;
  container: HTMLDivElement;
  clientX: number;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
}) {
  const bounds = container.getBoundingClientRect();
  const isLeftHalf = clientX - bounds.left < bounds.width / 2;

  if (isLeftHalf) {
    if (canNavigatePrev) {
      onNavigatePrev();
    }

    return;
  }

  onNavigateNext();
}

/**
 * Touch end events can land outside the original element when the user swipes
 * quickly. Looking up the tracked touch by identifier keeps gesture resolution
 * stable even when other fingers join or leave the screen.
 */
function findTouchById(touchList: TouchList, touchId: number) {
  for (let index = 0; index < touchList.length; index += 1) {
    const touch = touchList.item(index);

    if (touch?.identifier === touchId) {
      return touch;
    }
  }

  return null;
}

/**
 * Navigable read steps no longer show visible arrow chrome, so touch devices
 * need a direct gesture surface that maps into the existing next/prev actions.
 * This wrapper keeps swipe behavior local to those read-only screens while
 * desktop users continue to rely on keyboard navigation.
 */
export function SwipeNavigableStepLayout({
  canNavigatePrev,
  children,
  onNavigateNext,
  onNavigatePrev,
}: {
  canNavigatePrev: boolean;
  children: React.ReactNode;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
}) {
  const gestureRef = useRef<SwipeGesture | null>(null);
  const endHandlerRef = useRef<((event: globalThis.TouchEvent) => void) | null>(null);
  const cancelHandlerRef = useRef<(() => void) | null>(null);

  /**
   * Gesture bookkeeping lives in refs because this layer only needs the final
   * release decision. Keeping drag state out of React avoids the old
   * "everything moves with my finger" feeling the user called out.
   */
  function resetSwipeGesture() {
    gestureRef.current = null;
  }

  /**
   * Each touch gesture installs temporary window listeners so fast swipes still
   * resolve even if the finger ends outside the player bounds. Removing them as
   * soon as the gesture settles avoids stacking duplicate listeners.
   */
  function detachWindowTouchListeners() {
    const endHandler = endHandlerRef.current;

    if (endHandler) {
      globalThis.removeEventListener("touchend", endHandler);
      endHandlerRef.current = null;
    }

    const cancelHandler = cancelHandlerRef.current;

    if (cancelHandler) {
      globalThis.removeEventListener("touchcancel", cancelHandler);
      cancelHandlerRef.current = null;
    }
  }

  /**
   * Swipes should work anywhere in the read-only content, not only if the touch
   * ends inside the same DOM region. Resolving the gesture from a window-level
   * touchend listener makes quick swipes feel much more forgiving on mobile.
   */
  function resolveGesture(clientX: number, clientY: number) {
    const gesture = gestureRef.current;

    if (!gesture) {
      return;
    }

    const deltaX = clientX - gesture.startX;
    const deltaY = clientY - gesture.startY;

    if (isHorizontalSwipe({ deltaX, deltaY })) {
      if (deltaX < 0) {
        onNavigateNext();
      } else if (canNavigatePrev) {
        onNavigatePrev();
      }

      detachWindowTouchListeners();
      resetSwipeGesture();
      return;
    }

    const isTap =
      Math.abs(deltaX) <= TAP_DISTANCE_THRESHOLD && Math.abs(deltaY) <= TAP_DISTANCE_THRESHOLD;

    if (isTap) {
      runTapNavigation({
        canNavigatePrev,
        clientX,
        container: gesture.container,
        onNavigateNext,
        onNavigatePrev,
      });
    }

    detachWindowTouchListeners();
    resetSwipeGesture();
  }

  /**
   * Only touch input should trigger swipe or tap navigation. We also skip
   * obvious interactive descendants so taps on controls keep their native job.
   */
  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (event.touches.length !== 1 || isInteractiveSwipeTarget(event.target)) {
      detachWindowTouchListeners();
      resetSwipeGesture();
      return;
    }

    const touch = event.touches.item(0);

    if (!touch) {
      return;
    }

    detachWindowTouchListeners();
    gestureRef.current = {
      container: event.currentTarget,
      startX: touch.clientX,
      startY: touch.clientY,
      touchId: touch.identifier,
    };

    const handleWindowTouchEnd = (windowEvent: globalThis.TouchEvent) => {
      const trackedTouch = findTouchById(windowEvent.changedTouches, touch.identifier);

      if (!trackedTouch) {
        return;
      }

      resolveGesture(trackedTouch.clientX, trackedTouch.clientY);
    };

    const handleWindowTouchCancel = () => {
      detachWindowTouchListeners();
      resetSwipeGesture();
    };

    endHandlerRef.current = handleWindowTouchEnd;
    cancelHandlerRef.current = handleWindowTouchCancel;
    globalThis.addEventListener("touchend", handleWindowTouchEnd, { passive: true });
    globalThis.addEventListener("touchcancel", handleWindowTouchCancel, { passive: true });
  }

  /**
   * Gesture listeners are attached to `window` so fast swipes still resolve
   * even if the finger leaves the player bounds. They must be removed when the
   * component unmounts so a torn-down step cannot keep stale handlers alive.
   */
  useEffect(
    () => () => {
      detachWindowTouchListeners();
      resetSwipeGesture();
    },
    [],
  );

  return (
    <NavigableStepLayout onTouchStart={handleTouchStart}>
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col items-center">{children}</div>
    </NavigableStepLayout>
  );
}

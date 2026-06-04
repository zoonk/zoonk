"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type TouchEvent, useEffect, useRef } from "react";
import { NavigableStepLayout } from "./step-layouts";

const SWIPE_DISTANCE_THRESHOLD = 48;
const SWIPE_HORIZONTAL_RATIO = 1.05;
const VIEWPORT_ZOOM_SCALE_THRESHOLD = 1.01;

type SwipeGesture = { startX: number; startY: number; touchId: number };

export type SwipeNavigableStepFrame = "default" | "media";
type DesktopNavigationSide = "previous" | "next";

/**
 * Image-backed read steps need the swipe surface to use the full stage width
 * so the media column can bleed to the viewport edge. Text-only read steps keep
 * the narrower frame because long lines become harder to read at full width.
 */
function getNavigableFrameClass(frame: SwipeNavigableStepFrame) {
  if (frame === "media") {
    return "max-w-none";
  }

  return "";
}

/**
 * Desktop read screens still benefit from a visible navigation affordance, but
 * small touch screens use the surface for swipe navigation. The visibility
 * should follow the same width breakpoint as the bottom bar so landscape
 * tablets do not lose both explicit navigation surfaces.
 */
function DesktopNavigationButton({
  "aria-label": ariaLabel,
  children,
  onClick,
  side,
}: {
  "aria-label": string;
  children: React.ReactNode;
  onClick: () => void;
  side: DesktopNavigationSide;
}) {
  return (
    <Button
      aria-label={ariaLabel}
      aria-keyshortcuts={side === "previous" ? "ArrowLeft" : "ArrowRight"}
      className={cn(
        "bg-background/95 text-foreground border-border/70 ring-border/30 hover:bg-background hover:border-border absolute top-1/2 z-20 hidden size-11 -translate-y-1/2 opacity-95 shadow-lg ring-1 shadow-black/5 backdrop-blur-md transition-[background-color,border-color,color,opacity,scale,box-shadow] hover:opacity-100 hover:shadow-xl focus-visible:opacity-100 lg:flex [&_svg]:size-5",
        side === "previous" ? "left-4 xl:left-6" : "right-4 xl:right-6",
      )}
      onClick={onClick}
      size="icon-lg"
      type="button"
      variant="outline"
    >
      {children}
    </Button>
  );
}

/**
 * Buttons, links, and other controls should keep their native tap behavior.
 * The swipe layer only owns empty read-scene space so it does not steal
 * gestures from interactive descendants like the vocabulary audio button.
 */
function isInteractiveSwipeTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
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
 * Native pinch zoom should take over the image-reading interaction completely.
 * When the viewport is zoomed, single-finger touches are usually attempts to
 * inspect or pan the image rather than requests to change player steps.
 */
function isViewportZoomed() {
  return (globalThis.visualViewport?.scale ?? 1) > VIEWPORT_ZOOM_SCALE_THRESHOLD;
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
 * Navigable read steps keep touch gestures local to read-only screens. Taps
 * stay available for real content controls, horizontal swipes move
 * forward/back, and desktop users keep the subtle arrow/keyboard affordances.
 */
export function SwipeNavigableStepLayout({
  canNavigatePrev,
  children,
  frame = "default",
  onNavigateNext,
  onNavigatePrev,
}: {
  canNavigatePrev: boolean;
  children: React.ReactNode;
  frame?: SwipeNavigableStepFrame;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
}) {
  const t = useExtracted();
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

    if (isViewportZoomed()) {
      detachWindowTouchListeners();
      resetSwipeGesture();
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

    detachWindowTouchListeners();
    resetSwipeGesture();
  }

  /**
   * Only unzoomed single-touch input should trigger swipe navigation. We also
   * skip obvious interactive descendants so taps on controls keep their native
   * job.
   */
  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (
      event.touches.length !== 1 ||
      isInteractiveSwipeTarget(event.target) ||
      isViewportZoomed()
    ) {
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
    <NavigableStepLayout className={getNavigableFrameClass(frame)} onTouchStart={handleTouchStart}>
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col items-center">{children}</div>

      {canNavigatePrev && (
        <DesktopNavigationButton
          aria-label={t("Previous step")}
          onClick={onNavigatePrev}
          side="previous"
        >
          <ChevronLeftIcon />
        </DesktopNavigationButton>
      )}

      <DesktopNavigationButton aria-label={t("Next step")} onClick={onNavigateNext} side="next">
        <ChevronRightIcon />
      </DesktopNavigationButton>
    </NavigableStepLayout>
  );
}

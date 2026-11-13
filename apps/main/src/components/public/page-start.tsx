"use client";

import { BottomBar } from "@zoonk/ui/components/bottom-bar";
import { cn } from "@zoonk/ui/lib/utils";
import { type ReactNode, useEffect, useRef, useSyncExternalStore } from "react";

type MarkState = { isAbove: boolean; isOnScreen: boolean };

const marks = new Map<Element, MarkState>();
const listeners = new Set<() => void>();

let observer: IntersectionObserver | null = null;
let isAway = false;

function readIsAway(): boolean {
  const states = [...marks.values()];
  return states.some((state) => state.isAbove) && !states.some((state) => state.isOnScreen);
}

function update() {
  const next = readIsAway();

  if (next !== isAway) {
    isAway = next;
    listeners.forEach((listener) => listener());
  }
}

function getObserver(): IntersectionObserver {
  observer ??= new IntersectionObserver((entries) => {
    entries.forEach(({ boundingClientRect, isIntersecting, target }) => {
      if (marks.has(target)) {
        marks.set(target, {
          // A control hidden for this reader has an empty box at the page's origin, which isn't "above".
          isAbove: boundingClientRect.height > 0 && boundingClientRect.bottom <= 0,
          isOnScreen: isIntersecting,
        });
      }
    });

    update();
  });

  return observer;
}

function mark(element: Element): () => void {
  // On screen until measured, so a floating start never shows over a control that just arrived.
  marks.set(element, { isAbove: false, isOnScreen: true });
  getObserver().observe(element);
  update();

  return () => {
    getObserver().unobserve(element);
    marks.delete(element);
    update();
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Marks the element it sits in as a place the floating start button stays away from: one of the
 * page's own start controls, or the footer it would cover.
 */
export function PageStartMark() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const parent = ref.current?.parentElement;
    return parent ? mark(parent) : undefined;
  }, []);

  return <span hidden ref={ref} />;
}

/**
 * Shows its start button once the page's own has scrolled away, so the action is never on screen
 * twice. It keeps its room while hidden, so nothing beside it moves when it shows.
 */
export function ShownWhenStartAway({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const isShown = useSyncExternalStore(
    subscribe,
    () => isAway,
    () => false,
  );

  return (
    <div
      aria-hidden={!isShown}
      className={cn(
        "transition-opacity duration-150 ease-out motion-reduce:transition-none",
        isShown ? "opacity-100" : "pointer-events-none opacity-0",
        className,
      )}
      inert={!isShown}
    >
      {children}
    </div>
  );
}

/**
 * The shared bottom bar, out of the page's flow: it shows only after a scroll, so a bar in the flow
 * would leave an empty band at the page's end. `className` hides it from the width where the page's
 * bar or sidebar holds the button; `rowClassName` gives its row the frame's column.
 */
export function StickyStartBar({
  children,
  className,
  rowClassName,
}: {
  children: ReactNode;
  className?: string;
  rowClassName?: string;
}) {
  return (
    <ShownWhenStartAway
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 px-(--page-gutter) [--page-bottom:0px] [--page-dock:0px] [--page-gutter:--spacing(4)]",
        className,
      )}
    >
      <BottomBar className={rowClassName}>{children}</BottomBar>
    </ShownWhenStartAway>
  );
}

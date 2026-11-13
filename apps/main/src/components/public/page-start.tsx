"use client";

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

/** For a phone: `className` hides it from the width where the page's bar or sidebar holds the button. */
export function StickyStartBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ShownWhenStartAway
      className={cn(
        "bg-background/90 supports-backdrop-filter:bg-background/75 fixed inset-x-0 bottom-0 z-30 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md",
        className,
      )}
    >
      {children}
    </ShownWhenStartAway>
  );
}

"use client";

import { getScrollBehavior } from "@zoonk/ui/lib/scroll-behavior";
import { type RefObject, useEffect } from "react";
import { useLessonPlayer } from "./lesson-player-context";

const FEEDBACK_SELECTOR = [
  '[data-slot="feedback-panel"]',
  '[data-slot="lesson-result-notes"]',
].join(",");

const MARGIN = 16;

function getVisibleArea(scroller: HTMLElement) {
  const box = scroller.getBoundingClientRect();
  const bar = scroller.querySelector<HTMLElement>('[data-slot="lesson-action-bar"]');
  const isStuck = bar ? getComputedStyle(bar).position === "sticky" : false;

  return { bottom: box.bottom - (isStuck && bar ? bar.offsetHeight : 0), top: box.top };
}

function getScrollDelta(scroller: HTMLElement): number {
  const parts = [...scroller.querySelectorAll<HTMLElement>(FEEDBACK_SELECTOR)];

  if (parts.length === 0) {
    return 0;
  }

  const top = Math.min(...parts.map((part) => part.getBoundingClientRect().top));
  const bottom = Math.max(...parts.map((part) => part.getBoundingClientRect().bottom));
  const visible = getVisibleArea(scroller);

  if (top < visible.top) {
    return top - visible.top - MARGIN;
  }

  if (bottom > visible.bottom) {
    return Math.min(bottom - visible.bottom + MARGIN, top - visible.top - MARGIN);
  }

  return 0;
}

export function useRevealFeedback(scrollerRef: RefObject<HTMLElement | null>) {
  const { state } = useLessonPlayer();
  const showsFeedback = state.phase === "feedback";

  useEffect(() => {
    const scroller = scrollerRef.current;

    if (!showsFeedback || !scroller) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const delta = getScrollDelta(scroller);

      if (delta !== 0) {
        scroller.scrollBy({ behavior: getScrollBehavior(), top: delta });
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [scrollerRef, showsFeedback]);
}

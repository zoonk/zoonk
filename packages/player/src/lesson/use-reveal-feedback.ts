"use client";

import { getScrollBehavior } from "@zoonk/ui/lib/scroll-behavior";
import { type RefObject, useEffect } from "react";
import { useLessonPlayer } from "./lesson-player-context";

/** A screen's result wherever it shows: under the question, in an activity or inline. */
const FEEDBACK_SELECTOR = [
  '[data-slot="lesson-step-result"]',
  '[data-slot="activity-feedback"]',
  '[data-slot="inline-feedback"]',
  '[data-slot="lesson-result-notes"]',
].join(",");

/** Breathing room between the result and the edges it's scrolled to. */
const MARGIN = 16;

/** The part of the lesson's scroll area not covered by the action bar stuck to its bottom. */
function getVisibleArea(scroller: HTMLElement) {
  const box = scroller.getBoundingClientRect();
  const bar = scroller.querySelector<HTMLElement>('[data-slot="lesson-action-bar"]');
  const isStuck = bar ? getComputedStyle(bar).position === "sticky" : false;

  return { bottom: box.bottom - (isStuck && bar ? bar.offsetHeight : 0), top: box.top };
}

/**
 * How far to scroll so the result shows whole, or at least from its verdict down when it's taller
 * than the screen. Zero when it's already in view.
 */
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

/**
 * After a check, the verdict and its why come into view: on a phone they often land under a long
 * question or an activity, below the fold, where they'd be missed.
 */
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

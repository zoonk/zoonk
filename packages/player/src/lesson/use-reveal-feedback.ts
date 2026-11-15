"use client";

import { getScrollBehavior } from "@zoonk/ui/lib/scroll-behavior";
import { type RefObject, useEffect } from "react";
import { queryShown } from "./_utils/lesson-focus";
import { getRevealDelta } from "./_utils/reveal-feedback";
import { useLessonPlayer } from "./lesson-player-context";

const FEEDBACK_SELECTOR = [
  '[data-slot="feedback-panel"]',
  '[data-slot="lesson-result-notes"]',
].join(",");

const STAGE_SELECTOR = '[data-slot="lesson-stage"]';
const CHIP_SELECTOR = '[data-slot="activity-badge"]';
const TITLE_SELECTOR = "h2";
const VERDICT_SELECTOR = '[data-slot="feedback-verdict"]';
const OWN_SCROLL_EVENTS = ["wheel", "touchmove", "keydown"] as const;

function getVisibleArea(scroller: HTMLElement) {
  const box = scroller.getBoundingClientRect();
  const bar = scroller.querySelector<HTMLElement>('[data-slot="bottom-bar"]');
  const isStuck = bar ? getComputedStyle(bar).position === "sticky" : false;

  return { bottom: box.bottom - (isStuck && bar ? bar.offsetHeight : 0), top: box.top };
}

function getScrollDelta(scroller: HTMLElement): number {
  const stage = queryShown(STAGE_SELECTOR, scroller);
  const parts = [...(stage?.querySelectorAll<HTMLElement>(FEEDBACK_SELECTOR) ?? [])];

  if (!stage || parts.length === 0) {
    return 0;
  }

  const boxes = parts.map((part) => part.getBoundingClientRect());

  return getRevealDelta({
    chip: stage.querySelector(CHIP_SELECTOR)?.getBoundingClientRect() ?? null,
    feedback: {
      bottom: Math.max(...boxes.map((box) => box.bottom)),
      top: Math.min(...boxes.map((box) => box.top)),
    },
    titleTop: stage.querySelector(TITLE_SELECTOR)?.getBoundingClientRect().top ?? null,
    verdict: stage.querySelector(VERDICT_SELECTOR)?.getBoundingClientRect() ?? null,
    visible: getVisibleArea(scroller),
  });
}

/**
 * Scrolls a checked screen to its feedback, one frame after the check, once the bar holds its new
 * action. A canvas or a picture that finishes loading later moves the feedback, so it's revealed
 * again each time the screen's height changes, until the learner scrolls on their own.
 */
export function useRevealFeedback(scrollerRef: RefObject<HTMLElement | null>) {
  const { state } = useLessonPlayer();
  const showsFeedback = state.phase === "feedback";

  useEffect(() => {
    const scroller = scrollerRef.current;
    const stage = scroller && queryShown(STAGE_SELECTOR, scroller);

    if (!showsFeedback || !scroller || !stage) {
      return;
    }

    function reveal(target: HTMLElement) {
      const delta = getScrollDelta(target);

      if (delta !== 0) {
        target.scrollBy({ behavior: getScrollBehavior(), top: delta });
      }
    }

    const frame = requestAnimationFrame(() => reveal(scroller));
    let height = stage.offsetHeight;

    const observer = new ResizeObserver(() => {
      if (stage.offsetHeight !== height) {
        height = stage.offsetHeight;
        reveal(scroller);
      }
    });

    const stop = () => observer.disconnect();

    observer.observe(stage);

    for (const event of OWN_SCROLL_EVENTS) {
      scroller.addEventListener(event, stop, { once: true, passive: true });
    }

    return () => {
      cancelAnimationFrame(frame);
      stop();

      for (const event of OWN_SCROLL_EVENTS) {
        scroller.removeEventListener(event, stop);
      }
    };
  }, [scrollerRef, showsFeedback]);
}

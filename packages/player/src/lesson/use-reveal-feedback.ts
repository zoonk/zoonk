"use client";

import { getScrollBehavior } from "@zoonk/ui/lib/scroll-behavior";
import { type RefObject, useEffect } from "react";
import { type Reveal, getReveal } from "./_utils/reveal-feedback";
import { useLessonPlayer } from "./lesson-player-context";
import { getScreenRef } from "./use-kept-screens";

/** A challenge's result is its feedback, so it's revealed from its title. */
const FEEDBACK_SELECTOR = [
  '[data-slot="feedback-panel"]',
  '[data-slot="lesson-result-notes"]',
  '[data-slot="challenge-result"]',
].join(",");

const STAGE_SELECTOR = '[data-slot="lesson-stage"]';
const CHIP_SELECTOR = '[data-slot="activity-badge"]';
const TITLE_SELECTOR = "h2";

const PROTECTED_PARTS = [
  '[data-slot="activity-canvas"] p',
  '[data-slot="activity-canvas"] button',
  '[data-slot="activity-plot"]',
  '[data-slot="activity-numeric-check"] p',
  '[data-slot="activity-numeric-check"] [data-slot="input-group"]',
].join(",");

const OWN_SCROLL_EVENTS = ["wheel", "touchmove", "keydown"] as const;

function getVisibleArea(scroller: HTMLElement) {
  const box = scroller.getBoundingClientRect();
  const bar = scroller.querySelector<HTMLElement>('[data-slot="bottom-bar"]');
  const isStuck = bar ? getComputedStyle(bar).position === "sticky" : false;

  return { bottom: box.bottom - (isStuck && bar ? bar.offsetHeight : 0), top: box.top };
}

function getScrollReveal({
  scroller,
  stage,
}: {
  scroller: HTMLElement;
  stage: HTMLElement;
}): Reveal {
  const parts = [...stage.querySelectorAll<HTMLElement>(FEEDBACK_SELECTOR)];

  if (parts.length === 0) {
    return { delta: 0, extraRoom: 0 };
  }

  const boxes = parts.map((part) => part.getBoundingClientRect());

  const captions = [...stage.querySelectorAll(PROTECTED_PARTS)]
    .map((part) => part.getBoundingClientRect())
    .filter((box) => box.height > 0);

  return getReveal({
    chip: stage.querySelector(CHIP_SELECTOR)?.getBoundingClientRect() ?? null,
    feedback: {
      bottom: Math.max(...boxes.map((box) => box.bottom)),
      top: Math.min(...boxes.map((box) => box.top)),
    },
    parts: captions,
    room: scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop,
    title: stage.querySelector(TITLE_SELECTOR)?.getBoundingClientRect() ?? null,
    visible: getVisibleArea(scroller),
  });
}

/**
 * Scrolls a checked screen to its feedback, one frame after the check, once the bar holds its new
 * action. A canvas or a picture that finishes loading later moves the feedback, so it's revealed
 * again each time the screen's height changes, until the learner scrolls on their own. It watches
 * the screen that's showing, so going back to an answered screen, or to a retried question's
 * earlier attempt, watches that one.
 */
export function useRevealFeedback(scrollerRef: RefObject<HTMLElement | null>) {
  const { screen, state } = useLessonPlayer();
  const showsFeedback = state.phase === "feedback";
  const screenKey = screen.step ? getScreenRef(state, screen.step.id).key : null;

  useEffect(() => {
    const scroller = scrollerRef.current;

    const stage =
      scroller && screenKey !== null
        ? scroller.querySelector<HTMLElement>(
            `[data-screen="${CSS.escape(screenKey)}"] ${STAGE_SELECTOR}`,
          )
        : null;

    if (!showsFeedback || !scroller || !stage) {
      return;
    }

    let height = stage.offsetHeight;
    let addedRoom = 0;

    // Room added under the feedback sits below everything, so it moves nothing on screen.
    function reveal(shown: { scroller: HTMLElement; stage: HTMLElement }) {
      const { delta, extraRoom } = getScrollReveal(shown);

      if (extraRoom > 0) {
        addedRoom += extraRoom;
        shown.stage.style.paddingBottom = `${addedRoom}px`;
        height = shown.stage.offsetHeight;
      }

      if (delta !== 0) {
        shown.scroller.scrollBy({ behavior: getScrollBehavior(), top: delta });
      }
    }

    const frame = requestAnimationFrame(() => reveal({ scroller, stage }));

    const observer = new ResizeObserver(() => {
      if (stage.offsetHeight !== height) {
        height = stage.offsetHeight;
        reveal({ scroller, stage });
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
      stage.style.paddingBottom = "";

      for (const event of OWN_SCROLL_EVENTS) {
        scroller.removeEventListener(event, stop);
      }
    };
  }, [scrollerRef, screenKey, showsFeedback]);
}

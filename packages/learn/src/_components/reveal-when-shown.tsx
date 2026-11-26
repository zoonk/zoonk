"use client";

import { getScrollBehavior } from "@zoonk/ui/lib/scroll-behavior";
import { createContext, use, useEffect, useRef } from "react";
import { getReveal } from "../_utils/reveal-feedback";

const RevealedByScreen = createContext(false);

/** What the scroll may not leave as a sliver under the header: the question's title and its answers. */
const PROTECTED_PARTS = 'h1, h2, [data-slot="answer-option"], [data-slot="match-entry"]';

/** Around a screen that scrolls its own feedback into sight, as the lesson player does. */
export function OwnFeedbackReveal({ children }: { children: React.ReactNode }) {
  return <RevealedByScreen value>{children}</RevealedByScreen>;
}

function scrollerOf(element: HTMLElement): HTMLElement {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);

    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
      return node;
    }
  }

  return document.scrollingElement instanceof HTMLElement
    ? document.scrollingElement
    : document.documentElement;
}

/**
 * The part of the scroller the learner sees: the page scrolls under the task's sticky header, and
 * the pinned bar covers its bottom.
 */
function visibleArea(scroller: HTMLElement) {
  const isPage = scroller === document.scrollingElement;
  const box = isPage ? { bottom: window.innerHeight, top: 0 } : scroller.getBoundingClientRect();
  const header = document.querySelector('[data-slot="task-header"]')?.getBoundingClientRect();
  const bar = document.querySelector('[data-slot="bottom-bar"]')?.getBoundingClientRect();

  return {
    bottom: Math.min(box.bottom, bar?.top ?? box.bottom),
    top: isPage ? (header?.bottom ?? 0) : box.top,
  };
}

function reveal(panel: HTMLElement) {
  const scroller = scrollerOf(panel);
  const content = panel.closest("main") ?? document.body;
  const box = panel.getBoundingClientRect();

  const { delta } = getReveal({
    chip: null,
    feedback: { bottom: box.bottom, top: box.top },
    parts: [...content.querySelectorAll(PROTECTED_PARTS)]
      .filter((part) => !panel.contains(part))
      .map((part) => part.getBoundingClientRect())
      .filter((part) => part.height > 0),
    room: scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop,
    title: null,
    visible: visibleArea(scroller),
  });

  if (delta !== 0) {
    scroller.scrollBy({ behavior: getScrollBehavior(), top: delta });
  }
}

/**
 * Scrolls the element it's placed in into sight once it appears, when it's below the fold or under
 * the pinned bar, by the lesson player's rule (`getReveal`): the whole element shows, and what
 * scrolls away under the header leaves whole. One frame later, so the bar holds its new action.
 */
export function RevealWhenShown() {
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const panel = marker.current?.parentElement;

    if (!panel) {
      return;
    }

    const frame = requestAnimationFrame(() => reveal(panel));
    return () => cancelAnimationFrame(frame);
  }, []);

  return <span hidden ref={marker} />;
}

/** A verdict's reveal, unless its screen reveals its own feedback (`OwnFeedbackReveal`). */
export function RevealFeedbackWhenShown() {
  return use(RevealedByScreen) ? null : <RevealWhenShown />;
}

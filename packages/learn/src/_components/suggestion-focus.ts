"use client";

import { useEffect, useRef } from "react";

/** Whether the learner answered a suggestion: `true`, or the answer's name. */
export type Answered = boolean | string;

/**
 * Focuses the suggestion on each answer (and on mount when it replaced another in place): its
 * answers give way to what the answer did, so the keyboard keeps its place instead of falling back
 * to the page.
 */
export function useFocusOnAnswer({
  answered,
  focusOnMount,
  section,
}: {
  answered: Answered;
  focusOnMount: boolean;
  section: React.RefObject<HTMLElement | null>;
}) {
  const previous = useRef(focusOnMount ? null : answered);

  useEffect(() => {
    if ((answered || focusOnMount) && answered !== previous.current) {
      section.current?.focus();
    }

    previous.current = answered;
  }, [answered, focusOnMount, section]);
}

/**
 * Keeps the keyboard in the suggestion when the control it was on gives way in place (Preview to
 * the check, Try again to the result, Not now back to the offer): focus moves to the suggestion
 * instead of falling to the page. In the sheet, the sheet takes it.
 */
export function useFocusOnRemovedControl(section: React.RefObject<HTMLElement | null>) {
  const control = useRef<Element | null>(null);

  useEffect(() => {
    const element = section.current;

    const remember = (event: FocusEvent) => {
      control.current = event.target instanceof Element ? event.target : null;
    };

    element?.addEventListener("focusin", remember);
    return () => element?.removeEventListener("focusin", remember);
  }, [section]);

  useEffect(() => {
    const lost = document.activeElement === document.body;

    if (lost && control.current && !control.current.isConnected) {
      section.current?.focus();
    }
  });
}

"use client";

import { useLayoutEffect, useRef } from "react";
import { isFocusLost } from "../_utils/is-focus-lost";

/** A control that moved the learner on leaves with its screen, so the next screen's title takes focus. */
export function useFocusTitleOnNewScreen(screen: string) {
  const lastFocusedScreen = useRef(screen);

  useLayoutEffect(() => {
    if (lastFocusedScreen.current === screen) {
      return;
    }

    lastFocusedScreen.current = screen;

    if (!isFocusLost(document.activeElement)) {
      return;
    }

    const title = [
      ...document.querySelectorAll<HTMLElement>('[data-slot="onboarding-title"]'),
    ].find((heading) => heading.checkVisibility());

    title?.focus({ preventScroll: true });
  }, [screen]);
}

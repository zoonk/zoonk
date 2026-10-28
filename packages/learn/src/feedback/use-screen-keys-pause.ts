"use client";

import { useEffect } from "react";

const SCREEN_KEYS = new Set([
  "Enter",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
]);

const POPUP_SELECTOR = "[role='dialog'], [role='alertdialog'], [role='menu'], [role='listbox']";

const CAPTURE = { capture: true } as const;

/**
 * Screen shortcuts skip keys already handled, so keys pressed outside the popup are handled here
 * first and answer nothing.
 */
export function useScreenKeysPause(paused: boolean) {
  useEffect(() => {
    if (!paused) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target instanceof Element ? event.target : null;

      if (SCREEN_KEYS.has(event.key) && !target?.closest(POPUP_SELECTOR)) {
        event.preventDefault();
      }
    }

    globalThis.addEventListener("keydown", handleKeyDown, CAPTURE);
    return () => globalThis.removeEventListener("keydown", handleKeyDown, CAPTURE);
  }, [paused]);
}

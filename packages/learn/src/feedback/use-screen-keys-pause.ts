"use client";

import { useEffect } from "react";

/** The keys a screen answers or moves on with: Enter, the number keys and the arrows. */
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

/** A menu, sheet or dialog: keys pressed inside it are its own. */
const POPUP_SELECTOR = "[role='dialog'], [role='alertdialog'], [role='menu'], [role='listbox']";

const CAPTURE = { capture: true } as const;

/**
 * While a vote menu, the downvote sheet or the feedback form is open, the screen underneath keeps
 * still. Screen shortcuts skip keys already handled, so Enter, number and arrow keys pressed
 * outside the popup (as it opens or closes, or with focus left on the page) are handled here first
 * and answer nothing. Keys pressed inside the popup stay its own.
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

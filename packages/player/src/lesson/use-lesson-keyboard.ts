"use client";

import { useEnterKey, useKeyboardCallback } from "@zoonk/ui/hooks/keyboard";
import { useLessonPlayer, useLessonPlayerConfig } from "./lesson-player-context";
import { useLessonInteraction } from "./lesson-player-interaction";
import { useScreenTurns } from "./use-screen-turns";

/** Screen shortcuts leave keys to the control in focus: a field, a sheet, a focused button. */
const SCREEN_KEY = { mode: "none", screen: true } as const;

/**
 * Keyboard first: Enter runs the visible main action, the arrows move between screens, Escape
 * leaves. Number keys pick options in the option lists. Keys wait while a sheet is open, and
 * a focused control (an answer field, a button, a chip in an activity) keeps its own keys.
 */
export function useLessonKeyboard() {
  const { actions, screen, state } = useLessonPlayer();
  const { onExit } = useLessonPlayerConfig();
  const { isPaused } = useLessonInteraction();
  const turns = useScreenTurns();

  useEnterKey(() => {
    // The completion moment (the player's, a session block's or a guest's) owns its Enter.
    if (isPaused || state.phase === "completed") {
      return false;
    }

    const { primary } = screen;

    if (!primary || primary.disabled) {
      return false;
    }

    if (primary.action === "check") {
      actions.check();
      return;
    }

    actions.continue();
  });

  useKeyboardCallback(
    "ArrowRight",
    () => {
      if (!turns.forward()) {
        return false;
      }
    },
    SCREEN_KEY,
  );

  useKeyboardCallback(
    "ArrowLeft",
    () => {
      if (!turns.back()) {
        return false;
      }
    },
    SCREEN_KEY,
  );

  useKeyboardCallback(
    "Escape",
    () => {
      if (isPaused) {
        return false;
      }

      onExit();
    },
    SCREEN_KEY,
  );
}

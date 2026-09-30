"use client";

import { useEnterKey, useKeyboardCallback } from "@zoonk/ui/hooks/keyboard";
import { isReadStep } from "./_utils/lesson-steps";
import { useLessonPlayer, useLessonPlayerConfig } from "./lesson-player-context";
import { useLessonInteraction } from "./lesson-player-interaction";

/** Screen shortcuts leave keys to the control in focus: a field, a sheet, a focused button. */
const SCREEN_KEY = { mode: "none", screen: true } as const;

/**
 * Keyboard first: Enter runs the visible main action, the arrows move between reading screens,
 * Escape leaves. Number keys pick options in the option lists. Keys wait while a sheet is open, and
 * a focused control (an answer field, "Simpler", a chip in an activity) keeps its own keys.
 */
export function useLessonKeyboard() {
  const { actions, screen, state } = useLessonPlayer();
  const { onExit, slots } = useLessonPlayerConfig();
  const { isPaused } = useLessonInteraction();
  const isCompleted = state.phase === "completed";

  useEnterKey(() => {
    if (isPaused) {
      return false;
    }

    // A host's own completion moment or next steps (a session block's, a guest's) own its Enter.
    if (isCompleted && (slots.completion || slots.completionActions)) {
      return false;
    }

    if (isCompleted && state.completion?.status === "saved") {
      onExit();
      return;
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
      const isReading = screen.step ? isReadStep(screen.step) : false;

      if (
        isPaused ||
        !isReading ||
        screen.primary?.action !== "continue" ||
        state.phase !== "playing"
      ) {
        return false;
      }

      actions.continue();
    },
    SCREEN_KEY,
  );

  useKeyboardCallback(
    "ArrowLeft",
    () => {
      if (isPaused || !screen.canGoBack) {
        return false;
      }

      actions.goBack();
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

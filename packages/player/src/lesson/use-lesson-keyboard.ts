"use client";

import { useEnterKey, useKeyboardCallback } from "@zoonk/ui/hooks/keyboard";
import { useTutorBuddy } from "../questions/tutor-buddy";
import { useLeaveLesson } from "./lesson-leave";
import { useLessonPlayer } from "./lesson-player-context";
import { useLessonInteraction } from "./lesson-player-interaction";
import { useScreenTurns } from "./use-screen-turns";

const SCREEN_KEY = { mode: "none", screen: true } as const;

export function useLessonKeyboard() {
  const { actions, screen, state } = useLessonPlayer();
  const leave = useLeaveLesson();
  const { isPaused } = useLessonInteraction();
  const buddy = useTutorBuddy();
  const turns = useScreenTurns();

  useEnterKey(() => {
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

      if (buddy?.docked) {
        buddy.close();
        return;
      }

      leave();
    },
    SCREEN_KEY,
  );
}

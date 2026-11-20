"use client";

import { useEnterKey, useHeldEnterOnce, useShortcut } from "@zoonk/ui/hooks/keyboard";
import { useTutorBuddy } from "../questions/tutor-buddy";
import { runPrimary, useLessonPrimary } from "./lesson-action-bar";
import { useLessonPlayer } from "./lesson-player-context";
import { useLessonInteraction } from "./lesson-player-interaction";
import { useScreenTurns } from "./use-screen-turns";

export function useLessonKeyboard() {
  const { actions, screen, state } = useLessonPlayer();
  const primary = useLessonPrimary();
  const { isPaused } = useLessonInteraction();
  const buddy = useTutorBuddy();
  const turns = useScreenTurns({ keepFocus: true });

  useEnterKey(() => {
    if (isPaused || state.phase === "completed") {
      return false;
    }

    if (!primary || primary.disabled) {
      return false;
    }

    runPrimary({ actions, screen });
  });

  useHeldEnterOnce();

  useShortcut("next", () => {
    if (!turns.forward()) {
      return false;
    }
  });

  useShortcut("previous", () => {
    if (!turns.back()) {
      return false;
    }
  });

  // With nothing of the lesson's open, Esc is the ✕'s (`TaskClose`).
  useShortcut("leave", () => {
    if (isPaused || !buddy?.docked) {
      return false;
    }

    buddy.close();
  });
}

"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { focusLessonAfterTurn } from "./_utils/lesson-focus";
import { useLessonPlayer } from "./lesson-player-context";

/**
 * For a screen whose last move is its answer, such as a match board's last pair: the returned
 * function asks for a check, which runs once the answer has reached the lesson (`answered`), since
 * the lesson checks the answer it holds, and then hands focus to the screen's main action.
 */
export function useCheckWhenAnswered(answered: boolean): () => void {
  const { actions } = useLessonPlayer();
  const check = useEffectEvent(actions.check);
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current && answered) {
      asked.current = false;
      check();
      focusLessonAfterTurn();
    }
  }, [answered]);

  return () => {
    asked.current = true;
  };
}

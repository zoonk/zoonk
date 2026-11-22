"use client";

import { isDictation } from "@zoonk/core/lesson-player/playable-lesson";
import { useEffect } from "react";
import { useLessonPlayer } from "./lesson-player-context";
import { CANT_LISTEN_TODAY, useTodayChoice } from "./use-today-choice";

/** While the learner can't listen, the lesson leaves its dictations out, the screen in view included. */
export function useSkipUnheardDictations() {
  const { actions, state } = useLessonPlayer();
  const [cantListen] = useTodayChoice(CANT_LISTEN_TODAY);

  const dictations = Object.values(state.steps)
    .filter((step) => isDictation(step))
    .map((step) => step.id)
    .join(" ");

  useEffect(() => {
    if (cantListen && dictations) {
      actions.skipSteps(dictations.split(" "));
    }
  }, [actions, cantListen, dictations]);
}

"use client";

import { useEffect } from "react";
import { useLessonPlayer } from "./lesson-player-context";
import { type PlayableLibraryStep } from "./lesson-player-types";
import { CANT_LISTEN_TODAY, useTodayChoice } from "./use-today-choice";

function isDictation(step: PlayableLibraryStep): boolean {
  return (
    step.kind === "listening" && "exercise" in step && step.exercise.sentence?.readsItself === true
  );
}

/**
 * A listening sentence that is its own answer, as in a lesson in the learner's own language, can't
 * be read instead without giving the answer away, so while the learner can't listen it's left out,
 * as core leaves one out that has no sound.
 */
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

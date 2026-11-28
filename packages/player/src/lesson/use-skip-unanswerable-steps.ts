"use client";

import { isDictation } from "@zoonk/core/lesson-player/playable-lesson";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useLessonPlayer } from "./lesson-player-context";
import { getSpokenAnswerMode, useCanSpeak } from "./use-can-speak";
import { CANT_LISTEN_TODAY, CANT_TALK_TODAY, useTodayChoice } from "./use-today-choice";

/** While the learner can't listen, the lesson leaves its dictations out, the screen in view included. */
function useSkipUnheardDictations() {
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

/**
 * Speaking screens nobody can answer here leave the lesson, the screen in view included, before
 * the browser paints them. "I can't talk now" says so and can be undone; a device that can't
 * record leaves them out quietly, since there's nothing to undo.
 */
function useSkipUnspeakableSteps() {
  const { actions, state } = useLessonPlayer();
  const canSpeak = useCanSpeak();
  const [cantTalk] = useTodayChoice(CANT_TALK_TODAY);
  const [cantListen] = useTodayChoice(CANT_LISTEN_TODAY);
  const hasOpened = useRef(false);

  const unspeakable =
    canSpeak === null
      ? ""
      : Object.values(state.steps)
          .filter(
            (step) =>
              step.kind === "spokenAnswer" &&
              !(step.id in state.results) &&
              getSpokenAnswerMode({
                canListen: step.listening !== null && !cantListen,
                canSpeak,
                cantTalk,
              }) === null,
          )
          .map((step) => step.id)
          .join(" ");

  useLayoutEffect(() => {
    if (canSpeak === null) {
      return;
    }

    const opening = !hasOpened.current;
    hasOpened.current = true;

    if (!unspeakable) {
      return;
    }

    if (canSpeak) {
      actions.skipSpeaking(unspeakable.split(" "), { opening });
    } else {
      actions.skipSteps(unspeakable.split(" "));
    }
  }, [actions, canSpeak, unspeakable]);
}

/** Screens the learner can't answer today, by ear or aloud, are left out of the lesson. */
export function useSkipUnanswerableSteps() {
  useSkipUnheardDictations();
  useSkipUnspeakableSteps();
}

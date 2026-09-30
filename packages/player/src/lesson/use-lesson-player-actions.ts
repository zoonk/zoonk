"use client";

import { type AnalyticsEvent } from "@zoonk/core/analytics/events";
import { gradeStepAnswer } from "@zoonk/core/lesson-player/grade";
import { type Dispatch, useCallback, useMemo } from "react";
import { fromLocalGrade, revealGuess } from "./_utils/lesson-results";
import { isServerGradedAnswer } from "./_utils/lesson-steps";
import { type LessonPlayerActions } from "./lesson-player-context";
import { lessonPlayerReducer } from "./lesson-player-reducer";
import {
  type LessonPlayerAction,
  type LessonPlayerState,
  getCurrentStep,
} from "./lesson-player-state";
import { type LessonPlayerAdapters } from "./lesson-player-types";
import { useLessonRun } from "./use-lesson-run";
import { type CheckContext, useStepGrading } from "./use-step-grading";

type ActionsInput = {
  adapters: LessonPlayerAdapters;
  dispatch: Dispatch<LessonPlayerAction>;
  state: LessonPlayerState;
  track: (event: AnalyticsEvent) => void;
};

function analyticsFor(check: CheckContext, lessonId: string): AnalyticsEvent | null {
  if (check.step.kind === "activity") {
    return {
      name: "Activity Used",
      properties: { lesson_id: lessonId, template: check.step.content.template },
    };
  }

  return null;
}

/**
 * Turns learner intent into reducer actions and server calls. Checks, activities and exercises
 * are graded on the device at once and recorded in the background; typed and spoken answers wait
 * for the server's grade. Reaching the end saves the run once every answer is recorded.
 */
/** The screens each skippable activity is made of in a lesson. */
const SKIPPED_KINDS = { speaking: "spokenAnswer", writing: "typedAnswer" } as const;

export function useLessonPlayerActions({
  adapters,
  dispatch,
  state,
  track,
}: ActionsInput): LessonPlayerActions {
  const {
    ensureRun,
    flushChecks,
    resetRun,
    track: trackCheck,
  } = useLessonRun({ adapters, dispatch });

  const { gradeOnServer, recordInBackground, submitSpokenAnswer } = useStepGrading({
    adapters,
    dispatch,
    ensureRun,
    state,
    trackCheck,
  });

  const saveCompletion = useCallback(async () => {
    const [allSaved, runId] = await Promise.all([flushChecks(), ensureRun()]);
    const outcome = allSaved && runId ? await adapters.completeLesson({ runId }) : null;

    if (outcome?.status === "completed") {
      dispatch({ result: outcome.completion, type: "completionSaved" });
      return;
    }

    dispatch({ type: "completionFailed" });
  }, [adapters, dispatch, ensureRun, flushChecks]);

  /** Dispatches and, when this action finishes the lesson, saves it. */
  const dispatchAndSave = useCallback(
    (action: LessonPlayerAction) => {
      const next = lessonPlayerReducer(state, action);
      dispatch(action);

      if (state.phase !== "completed" && next.phase === "completed") {
        void saveCompletion();
      }
    },
    [dispatch, saveCompletion, state],
  );

  const check = useCallback(() => {
    const step = getCurrentStep(state);
    const answer = step ? state.answers[step.id] : undefined;

    if (!step || !answer || state.phase !== "playing") {
      return;
    }

    if (answer.kind === "hook") {
      const result = revealGuess({ optionId: answer.optionId, step });
      track({ name: "Hook Answered", properties: { lesson_id: state.lessonId } });
      void ensureRun();

      if (result) {
        dispatch({ counts: false, result, stepId: step.id, type: "checkResolved" });
      }

      return;
    }

    if (isServerGradedAnswer({ answer, step })) {
      void gradeOnServer({ answer, step });
      return;
    }

    const graded = gradeStepAnswer({ answer, step });

    if (!graded) {
      return;
    }

    const event = analyticsFor({ answer, step }, state.lessonId);

    if (event) {
      track(event);
    }

    dispatch({
      counts: true,
      result: fromLocalGrade(graded),
      stepId: step.id,
      type: "checkResolved",
    });

    recordInBackground({ answer, step });
  }, [dispatch, ensureRun, gradeOnServer, recordInBackground, state, track]);

  return useMemo(
    () => ({
      check,
      continue: () => {
        void ensureRun();
        dispatchAndSave({ type: "continue" });
      },
      explainFirst: () => dispatch({ type: "explainFirst" }),
      goBack: () => dispatch({ direction: "prev", type: "navigate" }),
      knowThis: () => dispatch({ type: "knowThis" }),
      restart: () => {
        resetRun();
        dispatch({ type: "restart" });
        void ensureRun();
      },
      retryCompletion: () => {
        dispatch({ type: "completionRetried" });
        void saveCompletion();
      },
      retryStart: () => void ensureRun(),
      selectAnswer: (stepId, answer) => dispatch({ answer, stepId, type: "selectAnswer" }),
      skipActivity: async (activity) => {
        const skipped = await adapters.skipLanguageActivity?.(activity);

        if (skipped) {
          dispatchAndSave({ kinds: [SKIPPED_KINDS[activity]], type: "skipKinds" });
        }
      },
      submitSpokenAnswer: (input) => void submitSpokenAnswer(input),
    }),
    [
      adapters,
      check,
      dispatch,
      dispatchAndSave,
      ensureRun,
      resetRun,
      saveCompletion,
      submitSpokenAnswer,
    ],
  );
}

"use client";

import { type AnalyticsEvent } from "@zoonk/core/analytics/events";
import { gradeStepAnswer } from "@zoonk/core/lesson-player/grade";
import { type Dispatch, useCallback, useEffect, useEffectEvent, useMemo } from "react";
import { fromLocalGrade, revealGuess } from "./_utils/lesson-results";
import { isServerGradedAnswer } from "./_utils/lesson-steps";
import { type LessonPlayerActions } from "./lesson-player-context";
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
  /** The lesson's language, which grading writes a number's unit in, as the server does. */
  language: string;
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
 * for the server's grade. Reaching the end from a learner's click saves the run once every answer
 * is recorded; a resumed all-answered run waits for Finish first.
 */
export function useLessonPlayerActions({
  adapters,
  dispatch,
  language,
  state,
  track,
}: ActionsInput): LessonPlayerActions {
  const { ensureRun, flushChecks, track: trackCheck } = useLessonRun({ adapters, dispatch });

  const { gradeOnServer, recordInBackground, submitSpokenAnswer } = useStepGrading({
    adapters,
    dispatch,
    ensureRun,
    state,
    trackCheck,
  });

  /**
   * Saves the finished run. When the server is missing an answer (it never arrived), the lesson
   * goes back to that screen with the run's answers instead of failing the save again and again.
   */
  const saveCompletion = useEffectEvent(async () => {
    const [allSaved, runId] = await Promise.all([flushChecks(), ensureRun()]);

    // A request that never reached the server (offline) fails like any other save.
    const outcome =
      allSaved && runId
        ? await adapters
            .completeLesson({
              runId,
              ...(state.skippedWritingStepIds.length > 0 && {
                skippedWritingStepIds: state.skippedWritingStepIds,
              }),
            })
            .catch(() => null)
        : null;

    if (outcome?.status === "completed") {
      dispatch({ result: outcome.completion, type: "completionSaved" });
      return;
    }

    const [restarted, pictures] =
      outcome?.status === "incomplete"
        ? await Promise.all([
            adapters.startLesson(runId ? { runId } : undefined).catch(() => null),
            adapters.getLessonPictures?.().catch(() => []) ?? Promise.resolve([]),
          ])
        : [null, []];

    if (restarted?.reason === "started") {
      dispatch({
        answers: restarted.answers,
        optionalStepIds: restarted.optionalStepIds,
        pictures,
        runId: restarted.runId,
        type: "runResynced",
      });

      return;
    }

    dispatch({ type: "completionFailed" });
  });

  const isSaving = state.phase === "completed" && state.completion?.status === "saving";

  useEffect(() => {
    if (isSaving) {
      void saveCompletion();
    }
  }, [isSaving]);

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

    const graded = gradeStepAnswer({ answer, language, step });

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
  }, [dispatch, ensureRun, gradeOnServer, language, recordInBackground, state, track]);

  return useMemo(
    () => ({
      check,
      continue: () => {
        void ensureRun();
        dispatch({ type: "continue" });
      },
      explainFirst: () => dispatch({ type: "explainFirst" }),
      goBack: () => dispatch({ direction: "prev", type: "navigate" }),
      knowThis: () => dispatch({ type: "knowThis" }),
      retryCompletion: () => dispatch({ type: "completionRetried" }),
      retryStart: () => void ensureRun(),
      selectAnswer: (stepId, answer) => dispatch({ answer, stepId, type: "selectAnswer" }),
      skipSteps: (stepIds) => dispatch({ stepIds, type: "skipSteps" }),
      skipWriting: (stepId) =>
        dispatch({
          kinds: ["typedAnswer"],
          ...(stepId && { stepIds: [stepId] }),
          type: "skipKinds",
        }),
      submitSpokenAnswer: (input) => void submitSpokenAnswer(input),
    }),
    [check, dispatch, ensureRun, submitSpokenAnswer],
  );
}

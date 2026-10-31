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
import { CANT_WRITE_TODAY, setChosenToday } from "./use-today-choice";

type ActionsInput = {
  adapters: LessonPlayerAdapters;
  dispatch: Dispatch<LessonPlayerAction>;
  language: string;
  state: LessonPlayerState;
  track: (event: AnalyticsEvent) => void;
  writeExampleLines: () => void;
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

export function useLessonPlayerActions({
  adapters,
  dispatch,
  language,
  state,
  track,
  writeExampleLines,
}: ActionsInput): LessonPlayerActions {
  const {
    ensureRun,
    flushChecks,
    keepGrade,
    track: trackCheck,
  } = useLessonRun({ adapters, dispatch });

  const { gradeOnServer, recordInBackground, submitSpokenAnswer } = useStepGrading({
    adapters,
    dispatch,
    ensureRun,
    keepGrade,
    state,
    trackCheck,
  });

  const saveCompletion = useEffectEvent(async () => {
    const [allSaved, runId] = await Promise.all([flushChecks(), ensureRun()]);

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

    writeExampleLines();

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

    const attemptId = crypto.randomUUID();

    dispatch({
      counts: true,
      result: { ...fromLocalGrade(graded), attemptId },
      stepId: step.id,
      type: "checkResolved",
    });

    recordInBackground({ answer, attemptId, step });
  }, [
    dispatch,
    ensureRun,
    gradeOnServer,
    language,
    recordInBackground,
    state,
    track,
    writeExampleLines,
  ]);

  return useMemo(
    () => ({
      check,
      continue: () => {
        void ensureRun();
        writeExampleLines();
        dispatch({ type: "continue" });
      },
      dontKnow: (stepId) => dispatch({ stepId, type: "skipWriting" }),
      explainFirst: () => dispatch({ type: "explainFirst" }),
      goBack: () => {
        writeExampleLines();
        dispatch({ direction: "prev", type: "navigate" });
      },
      knowThis: () => dispatch({ type: "knowThis" }),
      restoreWriting: () => {
        setChosenToday(CANT_WRITE_TODAY, false);
        dispatch({ type: "writingRestored" });
      },
      retryCompletion: () => dispatch({ type: "completionRetried" }),
      retryStart: () => void ensureRun(),
      selectAnswer: (stepId, answer) => dispatch({ answer, stepId, type: "selectAnswer" }),
      skipSteps: (stepIds) => dispatch({ stepIds, type: "skipSteps" }),
      skipWriting: () => {
        setChosenToday(CANT_WRITE_TODAY, true);
        dispatch({ type: "skipWriting" });
      },
      submitSpokenAnswer: (input) => void submitSpokenAnswer(input),
    }),
    [check, dispatch, ensureRun, submitSpokenAnswer, writeExampleLines],
  );
}

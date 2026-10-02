"use client";

import { type LessonStepAnswer } from "@zoonk/core/lesson-player/contract";
import { settleWithin } from "@zoonk/utils/timeout";
import { type Dispatch, useCallback } from "react";
import { fromServerCheck, fromSpokenGrade } from "./_utils/lesson-results";
import { type LessonPlayerAction, type LessonPlayerState } from "./lesson-player-state";
import { type LessonPlayerAdapters, type PlayableLibraryStep } from "./lesson-player-types";

export type CheckContext = { answer: LessonStepAnswer; step: PlayableLibraryStep };

/**
 * How long a grade the screen waits on may take. A typed answer is graded in a second or two
 * (Flash Lite, 1.2 s p50 in its eval), but a busy server has queued it for 25 s: past `slowMs` the
 * screen says it's still checking, and past `timeoutMs` it stops waiting and offers to check again
 * (the server takes one retried answer per screen). A spoken answer is uploaded and transcribed first.
 */
export const CHECK_BOUNDS = {
  slowMs: 15_000,
  timeoutMs: { spoken: 60_000, typed: 45_000 },
} as const;

/** The grade, or null when it failed, threw or took longer than the screen waits. */
async function boundedGrade<T>(ms: number, request: () => Promise<T>): Promise<T | null> {
  const settled = await settleWithin({ ms, request }).catch(() => null);
  return settled?.status === "settled" ? settled.value : null;
}

/**
 * The server side of grading: recording answers the device already graded, waiting for the grade
 * of typed answers, and sending recordings to the spoken answer grader.
 */
export function useStepGrading({
  adapters,
  dispatch,
  ensureRun,
  state,
  trackCheck,
}: {
  adapters: LessonPlayerAdapters;
  dispatch: Dispatch<LessonPlayerAction>;
  ensureRun: () => Promise<string | null>;
  state: LessonPlayerState;
  trackCheck: (check: () => Promise<boolean>) => void;
}) {
  const recordInBackground = useCallback(
    ({ answer, step }: CheckContext) => {
      const usedHelp = state.helped.includes(step.id);
      const durationMs = Date.now() - state.stepStartedAt;

      trackCheck(async () => {
        const runId = await ensureRun();

        const outcome = runId
          ? await adapters.checkStep({ answer, durationMs, runId, stepId: step.id, usedHelp })
          : null;

        if (outcome?.status !== "checked") {
          return false;
        }

        dispatch({ result: outcome.result, stepId: step.id, type: "checkConfirmed" });
        return true;
      });
    },
    [adapters, dispatch, ensureRun, state.helped, state.stepStartedAt, trackCheck],
  );

  const gradeOnServer = useCallback(
    async ({ answer, step }: CheckContext) => {
      const durationMs = Date.now() - state.stepStartedAt;
      dispatch({ stepId: step.id, type: "checkStarted" });
      const usedHelp = state.helped.includes(step.id);

      const outcome = await boundedGrade(CHECK_BOUNDS.timeoutMs.typed, async () => {
        const runId = await ensureRun();

        return runId
          ? adapters.checkStep({ answer, durationMs, runId, stepId: step.id, usedHelp })
          : null;
      });

      if (outcome?.status === "checked") {
        const answerText = "text" in answer ? answer.text : "";

        dispatch({
          counts: true,
          result: fromServerCheck({ answerText, result: outcome.result }),
          stepId: step.id,
          type: "checkResolved",
        });

        return;
      }

      dispatch({ stepId: step.id, type: "checkFailed" });
    },
    [adapters, dispatch, ensureRun, state.helped, state.stepStartedAt],
  );

  const submitSpokenAnswer = useCallback(
    async ({
      audio,
      durationMs: spokenMs,
      stepId,
    }: {
      audio: Blob;
      durationMs: number;
      stepId: string;
    }) => {
      const step = state.steps[stepId];

      if (!step || !adapters.gradeSpokenAnswer || state.phase !== "playing") {
        return;
      }

      dispatch({ stepId, type: "checkStarted" });
      const { gradeSpokenAnswer } = adapters;

      const outcome = await boundedGrade(CHECK_BOUNDS.timeoutMs.spoken, async () => {
        await ensureRun();
        return gradeSpokenAnswer({ audio, durationMs: spokenMs, stepId });
      });

      if (outcome?.status === "graded") {
        dispatch({
          counts: true,
          result: fromSpokenGrade({ grade: outcome.grade, step }),
          stepId,
          type: "checkResolved",
        });

        return;
      }

      const issue =
        outcome?.status === "limitReached" ||
        outcome?.status === "slowDown" ||
        outcome?.status === "noSpeech"
          ? outcome
          : undefined;

      dispatch({ issue, stepId, type: "checkFailed" });
    },
    [adapters, dispatch, ensureRun, state.phase, state.steps],
  );

  return { gradeOnServer, recordInBackground, submitSpokenAnswer };
}

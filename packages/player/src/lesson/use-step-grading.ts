"use client";

import { MAX_ANSWER_DURATION_MS } from "@zoonk/core/learner/contract";
import { type LessonStepAnswer } from "@zoonk/core/lesson-player/contract";
import { settleWithin } from "@zoonk/utils/timeout";
import { type Dispatch, useCallback } from "react";
import { fromServerCheck, fromSpokenGrade } from "./_utils/lesson-results";
import { type LessonPlayerAction, type LessonPlayerState } from "./lesson-player-state";
import { type LessonPlayerAdapters, type PlayableLibraryStep } from "./lesson-player-types";

export type CheckContext = { answer: LessonStepAnswer; step: PlayableLibraryStep };

/** An answer graded on the device, with the id it's saved under however often it's sent. */
type RecordContext = CheckContext & { attemptId: string };

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

/**
 * How long the learner took on the screen. A lesson left open overnight isn't hours of study, so
 * the time counts up to the server's answer limit and the answer still saves.
 */
function getAnswerDurationMs(stepStartedAt: number): number {
  return Math.min(Math.max(Date.now() - stepStartedAt, 0), MAX_ANSWER_DURATION_MS);
}

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
  keepGrade,
  state,
  trackCheck,
}: {
  adapters: LessonPlayerAdapters;
  dispatch: Dispatch<LessonPlayerAction>;
  ensureRun: () => Promise<string | null>;
  /** Sends a grade at once; the screen's later saves and the completion wait for it. */
  keepGrade: <T>(grade: { request: Promise<T>; stepId: string }) => Promise<T>;
  state: LessonPlayerState;
  trackCheck: (save: { check: () => Promise<boolean>; stepId: string }) => void;
}) {
  const recordInBackground = useCallback(
    ({ answer, attemptId, step }: RecordContext) => {
      const usedHelp = state.helped.includes(step.id);
      const durationMs = getAnswerDurationMs(state.stepStartedAt);

      const check = async () => {
        const runId = await ensureRun();

        const outcome = runId
          ? await adapters.checkStep({
              answer,
              attemptId,
              durationMs,
              runId,
              stepId: step.id,
              usedHelp,
            })
          : null;

        // A refusal never changes on a retry: the completion goes on, and the server's answers
        // decide whether the lesson is finished.
        if (outcome?.status === "refused") {
          return true;
        }

        if (outcome?.status !== "checked") {
          return false;
        }

        dispatch({ attemptId, result: outcome.result, stepId: step.id, type: "checkConfirmed" });
        return true;
      };

      trackCheck({ check, stepId: step.id });
    },
    [adapters, dispatch, ensureRun, state.helped, state.stepStartedAt, trackCheck],
  );

  const gradeOnServer = useCallback(
    async ({ answer, step }: CheckContext) => {
      const durationMs = getAnswerDurationMs(state.stepStartedAt);
      dispatch({ stepId: step.id, type: "checkStarted" });
      const usedHelp = state.helped.includes(step.id);

      // "Check again" after a timeout is a new grade, so each grade has its own id.
      const attemptId = crypto.randomUUID();

      const outcome = await boundedGrade(CHECK_BOUNDS.timeoutMs.typed, () =>
        keepGrade({
          request: ensureRun().then((runId) =>
            runId
              ? adapters.checkStep({
                  answer,
                  attemptId,
                  durationMs,
                  runId,
                  stepId: step.id,
                  usedHelp,
                })
              : null,
          ),
          stepId: step.id,
        }),
      );

      if (outcome?.status === "checked") {
        const answerText = "text" in answer ? answer.text : "";

        // A written answer that wasn't checked isn't a verdict: shown with the sample answer, it
        // counts neither way and doesn't come back.
        dispatch({
          counts: outcome.result.checked,
          result: fromServerCheck({ answerText, result: outcome.result }),
          stepId: step.id,
          type: "checkResolved",
        });

        return;
      }

      dispatch({ stepId: step.id, type: "checkFailed" });
    },
    [adapters, dispatch, ensureRun, keepGrade, state.helped, state.stepStartedAt],
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

      const outcome = await boundedGrade(CHECK_BOUNDS.timeoutMs.spoken, () =>
        keepGrade({
          request: ensureRun().then(() =>
            gradeSpokenAnswer({ audio, durationMs: spokenMs, stepId }),
          ),
          stepId,
        }),
      );

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
        outcome?.status === "signUpRequired" ||
        outcome?.status === "slowDown" ||
        outcome?.status === "noSpeech"
          ? outcome
          : undefined;

      dispatch({ issue, stepId, type: "checkFailed" });
    },
    [adapters, dispatch, ensureRun, keepGrade, state.phase, state.steps],
  );

  return { gradeOnServer, recordInBackground, submitSpokenAnswer };
}

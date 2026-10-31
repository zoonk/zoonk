"use client";

import { MAX_ANSWER_DURATION_MS } from "@zoonk/core/learner/contract";
import { type LessonStepAnswer } from "@zoonk/core/lesson-player/contract";
import { settleWithin } from "@zoonk/utils/timeout";
import { type Dispatch, useCallback } from "react";
import { fromServerCheck, fromSpokenGrade } from "./_utils/lesson-results";
import { type LessonPlayerAction, type LessonPlayerState } from "./lesson-player-state";
import { type LessonPlayerAdapters, type PlayableLibraryStep } from "./lesson-player-types";

export type CheckContext = { answer: LessonStepAnswer; step: PlayableLibraryStep };

type RecordContext = CheckContext & { attemptId: string };

export const CHECK_BOUNDS = {
  slowMs: 15_000,
  timeoutMs: { spoken: 60_000, typed: 45_000 },
} as const;

function getAnswerDurationMs(stepStartedAt: number): number {
  return Math.min(Math.max(Date.now() - stepStartedAt, 0), MAX_ANSWER_DURATION_MS);
}

async function boundedGrade<T>(ms: number, request: () => Promise<T>): Promise<T | null> {
  const settled = await settleWithin({ ms, request }).catch(() => null);
  return settled?.status === "settled" ? settled.value : null;
}

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

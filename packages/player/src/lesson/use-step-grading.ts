"use client";

import { MAX_ANSWER_DURATION_MS } from "@zoonk/core/learner/contract";
import { type LessonStepAnswer } from "@zoonk/core/lesson-player/contract";
import { CHECK_SLOW_MS } from "@zoonk/learn/check-note";
import { settleWithin } from "@zoonk/utils/timeout";
import { type Dispatch, useCallback, useRef } from "react";
import { fromServerCheck, fromSpokenGrade } from "./_utils/lesson-results";
import { type UnsentAnswer } from "./_utils/unsent-answers";
import { type LessonPlayerAction, type LessonPlayerState } from "./lesson-player-state";
import { type LessonPlayerAdapters, type PlayableLibraryStep } from "./lesson-player-types";

export type CheckContext = { answer: LessonStepAnswer; step: PlayableLibraryStep };

type RecordContext = CheckContext & { attemptId: string; isCorrect: boolean };

type PendingAttempt = { attemptId: string; text: string };

/** @internal */
export const CHECK_BOUNDS = {
  slowMs: CHECK_SLOW_MS,
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
  hold,
  keepGrade,
  resendUnsaved,
  state,
}: {
  adapters: LessonPlayerAdapters;
  dispatch: Dispatch<LessonPlayerAction>;
  ensureRun: () => Promise<{ runId: string } | null>;
  hold: (check: Omit<UnsentAnswer, "runId">) => void;
  keepGrade: <T>(grade: { request: Promise<T>; stepId: string }) => Promise<T>;
  resendUnsaved: () => Promise<boolean>;
  state: LessonPlayerState;
}) {
  const pendingRef = useRef(new Map<string, PendingAttempt>());

  const recordInBackground = useCallback(
    ({ answer, attemptId, isCorrect, step }: RecordContext) => {
      hold({
        answer,
        answeredAt: new Date().toISOString(),
        attemptId,
        durationMs: getAnswerDurationMs(state.stepStartedAt),
        isCorrect,
        stepId: step.id,
        usedHelp: state.helped.includes(step.id),
      });
    },
    [hold, state.helped, state.stepStartedAt],
  );

  const gradeOnServer = useCallback(
    async ({
      answer,
      answerText: localAnswerText,
      step,
    }: CheckContext & { answerText?: string | null }) => {
      const durationMs = getAnswerDurationMs(state.stepStartedAt);
      dispatch({ stepId: step.id, type: "checkStarted" });
      const usedHelp = state.helped.includes(step.id);
      const answerText = localAnswerText ?? ("text" in answer ? answer.text : "");
      const pending = pendingRef.current.get(step.id);

      // Asked again after its reply was lost, the server replays the saved verdict for the same id.
      const attemptId = pending?.text === answerText ? pending.attemptId : crypto.randomUUID();
      pendingRef.current.set(step.id, { attemptId, text: answerText });

      const outcome = await boundedGrade(CHECK_BOUNDS.timeoutMs.typed, () =>
        keepGrade({
          request: ensureRun().then((run) =>
            run
              ? adapters.checkStep({
                  answer,
                  attemptId,
                  durationMs,
                  runId: run.runId,
                  stepId: step.id,
                  usedHelp,
                })
              : null,
          ),
          stepId: step.id,
        }),
      );

      if (outcome?.status === "checked") {
        pendingRef.current.delete(step.id);

        dispatch({
          counts: outcome.result.checked,
          result: fromServerCheck({ answerText, result: outcome.result }),
          stepId: step.id,
          type: "checkResolved",
        });

        void resendUnsaved();
        return;
      }

      dispatch({ stepId: step.id, type: "checkFailed" });
    },
    [adapters, dispatch, ensureRun, keepGrade, resendUnsaved, state.helped, state.stepStartedAt],
  );

  // The take right after a missed start goes unmeasured, so it's never called missed twice.
  const missedStartRef = useRef<string | null>(null);

  const submitSpokenAnswer = useCallback(
    async ({
      attemptId,
      audio,
      durationMs: spokenMs,
      micStartupMs,
      stepId,
    }: {
      attemptId: string;
      audio: Blob;
      durationMs: number;
      micStartupMs?: number;
      stepId: string;
    }) => {
      const step = state.steps[stepId];

      if (!step || !adapters.gradeSpokenAnswer || state.phase !== "playing") {
        return;
      }

      dispatch({ stepId, type: "checkStarted" });
      const { gradeSpokenAnswer } = adapters;
      const measured = micStartupMs !== undefined && missedStartRef.current !== stepId;
      missedStartRef.current = null;

      const outcome = await boundedGrade(CHECK_BOUNDS.timeoutMs.spoken, () =>
        keepGrade({
          request: ensureRun().then((run) =>
            run
              ? gradeSpokenAnswer({
                  attemptId,
                  audio,
                  durationMs: spokenMs,
                  ...(measured && { micStartupMs }),
                  stepId,
                })
              : null,
          ),
          stepId,
        }),
      );

      if (outcome?.status === "graded") {
        dispatch({
          counts: outcome.grade.checked !== false,
          result: fromSpokenGrade({ grade: outcome.grade, step }),
          stepId,
          type: "checkResolved",
        });

        void resendUnsaved();
        return;
      }

      const issue =
        outcome?.status === "limitReached" ||
        outcome?.status === "signUpRequired" ||
        outcome?.status === "slowDown" ||
        outcome?.status === "missedStart" ||
        outcome?.status === "noSpeech"
          ? outcome
          : undefined;

      if (outcome?.status === "missedStart") {
        missedStartRef.current = stepId;
      }

      dispatch({ issue, stepId, type: "checkFailed" });
    },
    [adapters, dispatch, ensureRun, keepGrade, resendUnsaved, state.phase, state.steps],
  );

  return { gradeOnServer, recordInBackground, submitSpokenAnswer };
}

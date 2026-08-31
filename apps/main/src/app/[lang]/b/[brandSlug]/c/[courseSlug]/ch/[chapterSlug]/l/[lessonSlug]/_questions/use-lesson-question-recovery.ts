"use client";

import { safeAsync } from "@zoonk/utils/error";
import { type Dispatch, useEffect, useRef } from "react";
import { getLessonQuestionRequest } from "./lesson-question-api";
import {
  getLessonQuestionPollDelay,
  hasLessonQuestionPollingBudget,
} from "./lesson-question-polling";
import { type LessonQuestionAction, type LessonQuestionState } from "./lesson-question-state";
import {
  isLessonQuestionAnswerInProgress,
  isRetryableLessonQuestionStatusError,
} from "./lesson-question-status";

const MAX_TIMER_DELAY_MILLISECONDS = 2_147_000_000;

function waitForPollDelay({ delay, signal }: { delay: number; signal: AbortSignal }) {
  if (signal.aborted) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const timeoutId = globalThis.setTimeout(finish, delay);

    function finish() {
      globalThis.clearTimeout(timeoutId);
      signal.removeEventListener("abort", finish);
      resolve();
    }

    signal.addEventListener("abort", finish, { once: true });
  });
}

function isPollingAvailable() {
  return document.visibilityState === "visible" && navigator.onLine;
}

function waitForPollingAvailability(signal: AbortSignal) {
  if (signal.aborted || isPollingAvailable()) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    function finishIfAvailable() {
      if (!signal.aborted && !isPollingAvailable()) {
        return;
      }

      document.removeEventListener("visibilitychange", finishIfAvailable);
      globalThis.removeEventListener("online", finishIfAvailable);
      signal.removeEventListener("abort", finishIfAvailable);
      resolve();
    }

    document.addEventListener("visibilitychange", finishIfAvailable);
    globalThis.addEventListener("online", finishIfAvailable);
    signal.addEventListener("abort", finishIfAvailable, { once: true });
  });
}

function getPendingQuestionId(questions: LessonQuestionState["questions"]) {
  return questions.find((question) => question.status === "pending")?.id ?? null;
}

function getRunningQuestionId(questions: LessonQuestionState["questions"]) {
  return questions.find((question) => question.status === "running")?.id ?? null;
}

function getAnswerLimit(answerError: LessonQuestionState["answerError"]) {
  if (answerError?.reason.kind !== "limit") {
    return null;
  }

  return { questionId: answerError.questionId, retryAt: answerError.reason.retryAt };
}

export function useLessonQuestionRecovery({
  canAskQuestions,
  dispatch,
  state,
  streamAnswer,
}: {
  canAskQuestions: boolean;
  dispatch: Dispatch<LessonQuestionAction>;
  state: LessonQuestionState;
  streamAnswer: (questionId: string) => Promise<void>;
}) {
  const resumedPendingQuestionIds = useRef(new Set<string>());
  const pendingQuestionId = getPendingQuestionId(state.questions);
  const runningQuestionId = getRunningQuestionId(state.questions);
  const hasRunningQuestion = runningQuestionId !== null;

  useEffect(() => {
    if (
      !canAskQuestions ||
      !state.isOpen ||
      !pendingQuestionId ||
      state.activeQuestionId ||
      state.isCreating ||
      hasRunningQuestion ||
      resumedPendingQuestionIds.current.has(pendingQuestionId)
    ) {
      return;
    }

    const questionId = pendingQuestionId;
    resumedPendingQuestionIds.current.add(questionId);

    async function resumePendingQuestion() {
      const { error } = await safeAsync(() => streamAnswer(questionId));
      resumedPendingQuestionIds.current.delete(questionId);

      if (error) {
        dispatch({ questionId, reason: { kind: "unknown" }, type: "answerFailed" });
      }
    }

    void resumePendingQuestion();
  }, [
    dispatch,
    hasRunningQuestion,
    canAskQuestions,
    pendingQuestionId,
    state.activeQuestionId,
    state.isCreating,
    state.isOpen,
    streamAnswer,
  ]);

  const remoteRunningQuestionId = state.activeQuestionId === null ? runningQuestionId : null;

  useEffect(() => {
    if (!canAskQuestions || !state.isOpen || !remoteRunningQuestionId) {
      return;
    }

    const abortController = new AbortController();
    const questionId = remoteRunningQuestionId;
    const startedAt = Date.now();

    async function pollAnswerStatus(attempt: number) {
      const delay = getLessonQuestionPollDelay({
        attempt,
        elapsedMilliseconds: Date.now() - startedAt,
      });

      if (delay === null) {
        return;
      }

      await waitForPollDelay({ delay, signal: abortController.signal });
      await waitForPollingAvailability(abortController.signal);

      if (
        abortController.signal.aborted ||
        !hasLessonQuestionPollingBudget({ attempt, elapsedMilliseconds: Date.now() - startedAt })
      ) {
        return;
      }

      const result = await getLessonQuestionRequest({ questionId, signal: abortController.signal });

      if (abortController.signal.aborted) {
        return;
      }

      if (result.status === "error") {
        if (isRetryableLessonQuestionStatusError(result.error)) {
          await pollAnswerStatus(attempt + 1);
          return;
        }

        dispatch({ questionId, reason: result.error, type: "answerFailed" });

        return;
      }

      dispatch({ questions: [result.data], type: "latestThreadReconciled" });

      if (isLessonQuestionAnswerInProgress(result.data)) {
        await pollAnswerStatus(attempt + 1);
      }
    }

    void pollAnswerStatus(0);

    return () => {
      abortController.abort();
    };
  }, [canAskQuestions, dispatch, remoteRunningQuestionId, state.isOpen]);

  const limitError = getAnswerLimit(state.answerError);

  useEffect(() => {
    if (!limitError) {
      return;
    }

    const retryAt = Date.parse(limitError.retryAt);
    const questionId = limitError.questionId;

    if (!Number.isFinite(retryAt)) {
      return;
    }

    const timeoutIds = new Set<ReturnType<typeof globalThis.setTimeout>>();

    function scheduleLimitReset() {
      const remainingMilliseconds = retryAt - Date.now();

      if (remainingMilliseconds <= 0) {
        dispatch({ questionId, type: "answerLimitExpired" });
        return;
      }

      const timeoutId = globalThis.setTimeout(
        () => {
          timeoutIds.delete(timeoutId);
          scheduleLimitReset();
        },
        Math.min(remainingMilliseconds, MAX_TIMER_DELAY_MILLISECONDS),
      );

      timeoutIds.add(timeoutId);
    }

    scheduleLimitReset();

    return () => {
      timeoutIds.forEach((timeoutId) => globalThis.clearTimeout(timeoutId));
    };
  }, [dispatch, limitError]);
}

"use client";

import { type Dispatch, useEffect } from "react";
import { type LessonQuestionConnection, getLessonQuestionRequest } from "./lesson-question-api";
import {
  getLessonQuestionPollDelay,
  hasLessonQuestionPollingBudget,
} from "./lesson-question-polling";
import { type LessonQuestionAction, type LessonQuestionState } from "./lesson-question-state";
import {
  isLessonQuestionAnswerInProgress,
  isRetryableLessonQuestionStatusError,
} from "./lesson-question-status";

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

/**
 * While the conversation is on screen (`isShown`: an open sheet, or a page), a question waiting
 * for its answer or being written elsewhere is followed with read-only status requests. A pending
 * answer never starts from this effect; the learner can ask for it with Get answer.
 */
export function useLessonQuestionRecovery({
  connection,
  canAskQuestions,
  dispatch,
  isShown,
  state,
}: {
  connection: LessonQuestionConnection;
  canAskQuestions: boolean;
  dispatch: Dispatch<LessonQuestionAction>;
  isShown: boolean;
  state: LessonQuestionState;
}) {
  const pendingQuestionId = getPendingQuestionId(state.questions);
  const runningQuestionId = getRunningQuestionId(state.questions);

  const remoteQuestionId =
    state.activeQuestionId === null ? (runningQuestionId ?? pendingQuestionId) : null;

  useEffect(() => {
    if (!canAskQuestions || !isShown || !remoteQuestionId) {
      return;
    }

    const abortController = new AbortController();
    const questionId = remoteQuestionId;
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

      const result = await getLessonQuestionRequest({
        connection,
        questionId,
        signal: abortController.signal,
      });

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
  }, [connection, canAskQuestions, dispatch, isShown, remoteQuestionId]);
}

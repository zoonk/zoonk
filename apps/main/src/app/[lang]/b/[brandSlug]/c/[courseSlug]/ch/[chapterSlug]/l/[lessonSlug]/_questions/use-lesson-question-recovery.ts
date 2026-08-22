"use client";

import { safeAsync } from "@zoonk/utils/error";
import { type Dispatch, useEffect, useRef } from "react";
import { getLessonQuestionThreadRequest } from "./lesson-question-api";
import { type LessonQuestionAction, type LessonQuestionState } from "./lesson-question-state";

const ANSWER_STATUS_POLL_INTERVAL_MILLISECONDS = 1500;
const MAX_TIMER_DELAY_MILLISECONDS = 2_147_000_000;

function waitForAnswerStatusPoll() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ANSWER_STATUS_POLL_INTERVAL_MILLISECONDS);
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
  dispatch,
  isAuthenticated,
  lessonId,
  state,
  streamAnswer,
}: {
  dispatch: Dispatch<LessonQuestionAction>;
  isAuthenticated: boolean;
  lessonId: string;
  state: LessonQuestionState;
  streamAnswer: (questionId: string) => Promise<void>;
}) {
  const resumedPendingQuestionIds = useRef(new Set<string>());
  const pendingQuestionId = getPendingQuestionId(state.questions);
  const runningQuestionId = getRunningQuestionId(state.questions);
  const hasRunningQuestion = runningQuestionId !== null;

  useEffect(() => {
    if (
      !isAuthenticated ||
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
    isAuthenticated,
    pendingQuestionId,
    state.activeQuestionId,
    state.isCreating,
    state.isOpen,
    streamAnswer,
  ]);

  const remoteRunningQuestionId = state.activeQuestionId === null ? runningQuestionId : null;

  useEffect(() => {
    if (!isAuthenticated || !state.isOpen || !remoteRunningQuestionId) {
      return;
    }

    let isCancelled = false;
    const questionId = remoteRunningQuestionId;

    async function pollAnswerStatus() {
      await waitForAnswerStatusPoll();

      if (isCancelled) {
        return;
      }

      const result = await getLessonQuestionThreadRequest({ lessonId });

      if (isCancelled) {
        return;
      }

      if (result.status === "error") {
        if (result.error.kind === "unknown") {
          void pollAnswerStatus();
          return;
        }

        dispatch({ questionId, reason: result.error, type: "answerFailed" });

        return;
      }

      const questions = result.data?.questions ?? [];

      dispatch({ questions, type: "latestThreadReconciled" });

      if (questions.some((question) => question.status === "running")) {
        void pollAnswerStatus();
      }
    }

    void pollAnswerStatus();

    return () => {
      isCancelled = true;
    };
  }, [dispatch, isAuthenticated, lessonId, remoteRunningQuestionId, state.isOpen]);

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

"use client";

import { type Dispatch, useCallback, useRef } from "react";
import {
  type LessonQuestionConnection,
  getLessonQuestionRequest,
  streamLessonQuestionAnswerRequest,
} from "./lesson-question-api";
import { type LessonQuestionAction, type LessonQuestionState } from "./lesson-question-state";
import {
  hasOtherAnswerInProgress,
  isRetryableLessonQuestionStatusError,
} from "./lesson-question-status";

export function useLessonQuestionAnswers({
  connection,
  canAskQuestions,
  dispatch,
  state,
}: {
  connection: LessonQuestionConnection;
  canAskQuestions: boolean;
  dispatch: Dispatch<LessonQuestionAction>;
  state: LessonQuestionState;
}) {
  const answerChecksInFlight = useRef(new Set<string>());

  const reconcileAnswerFailure = useCallback(
    async ({ questionId, reason }: Extract<LessonQuestionAction, { type: "answerFailed" }>) => {
      const result = await getLessonQuestionRequest({ connection, questionId });

      if (result.status === "error") {
        dispatch({ questionId, reason, type: "answerFailed" });
        return;
      }

      const question = result.data;

      if (question.status === "pending") {
        dispatch({ questionId, reason, type: "answerFailed" });
        return;
      }

      dispatch({ questions: [question], type: "latestThreadReconciled" });

      if (question.status === "failed") {
        dispatch({ questionId, reason, type: "answerFailed" });
      }
    },
    [connection, dispatch],
  );

  const streamAnswer = useCallback(
    async (questionId: string) => {
      dispatch({ questionId, type: "answerStarted" });

      const result = await streamLessonQuestionAnswerRequest({
        connection,
        onChunk: (chunk) => dispatch({ chunk, questionId, type: "answerChunkReceived" }),
        questionId,
      });

      if (result.status === "error") {
        await reconcileAnswerFailure({ questionId, reason: result.error, type: "answerFailed" });
        return;
      }

      dispatch({ questionId, type: "answerCompleted" });
    },
    [connection, dispatch, reconcileAnswerFailure],
  );

  const retryAnswer = useCallback(
    async (questionId: string) => {
      const question = state.questions.find((candidate) => candidate.id === questionId);

      if (
        !canAskQuestions ||
        state.activeQuestionId ||
        !question ||
        question.status !== "failed" ||
        hasOtherAnswerInProgress({ questionId, questions: state.questions })
      ) {
        return;
      }

      await streamAnswer(questionId);
    },
    [canAskQuestions, state.activeQuestionId, state.questions, streamAnswer],
  );

  const checkAnswer = useCallback(
    async (questionId: string) => {
      const question = state.questions.find((candidate) => candidate.id === questionId);

      if (
        !canAskQuestions ||
        state.activeQuestionId ||
        question?.status !== "running" ||
        answerChecksInFlight.current.has(questionId)
      ) {
        return;
      }

      answerChecksInFlight.current.add(questionId);
      const result = await getLessonQuestionRequest({ connection, questionId });
      answerChecksInFlight.current.delete(questionId);

      if (result.status === "error") {
        if (!isRetryableLessonQuestionStatusError(result.error)) {
          dispatch({ questionId, reason: result.error, type: "answerFailed" });
        }

        return;
      }

      dispatch({ questions: [result.data], type: "latestThreadReconciled" });
    },
    [connection, canAskQuestions, dispatch, state.activeQuestionId, state.questions],
  );

  return { checkAnswer, retryAnswer, streamAnswer };
}

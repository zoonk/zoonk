"use client";

import { type Dispatch, useCallback, useRef } from "react";
import {
  type LessonQuestionConnection,
  getLessonQuestionRequest,
  streamLessonQuestionAnswerRequest,
} from "./lesson-question-api";
import { type LessonQuestionContext } from "./lesson-question-context";
import { type LessonQuestionSessionAction } from "./lesson-question-sessions";
import { type LessonQuestionAction, type LessonQuestionState } from "./lesson-question-state";
import {
  hasOtherAnswerInProgress,
  isRetryableLessonQuestionStatusError,
} from "./lesson-question-status";

export function useLessonQuestionAnswers({
  connection,
  canAskQuestions,
  dispatch,
  dispatchToContext,
  getState,
  state,
}: {
  connection: LessonQuestionConnection;
  canAskQuestions: boolean;
  dispatch: Dispatch<LessonQuestionAction>;
  dispatchToContext: Dispatch<LessonQuestionSessionAction>;
  getState: (context: LessonQuestionContext) => LessonQuestionState;
  state: LessonQuestionState;
}) {
  const answerChecksInFlight = useRef(new Set<string>());

  const reconcileAnswerFailure = useCallback(
    async ({
      context,
      questionId,
      reason,
    }: { context: LessonQuestionContext } & Extract<
      LessonQuestionAction,
      { type: "answerFailed" }
    >) => {
      const dispatchToSession = (action: LessonQuestionAction) =>
        dispatchToContext({ action, context });

      const result = await getLessonQuestionRequest({ connection, questionId });

      if (result.status === "error") {
        dispatchToSession({ questionId, reason, type: "answerFailed" });
        return;
      }

      const question = result.data;

      if (question.status === "pending") {
        dispatchToSession({ questionId, reason, type: "answerFailed" });
        return;
      }

      dispatchToSession({ questions: [question], type: "latestThreadReconciled" });

      if (question.status === "failed") {
        dispatchToSession({ questionId, reason, type: "answerFailed" });
      }
    },
    [connection, dispatchToContext],
  );

  const streamAnswer = useCallback(
    async ({ context, questionId }: { context: LessonQuestionContext; questionId: string }) => {
      const currentState = getState(context);

      const dispatchToSession = (action: LessonQuestionAction) =>
        dispatchToContext({ action, context });

      if (
        currentState.activeQuestionId ||
        currentState.questions.find((question) => question.id === questionId)?.status ===
          "completed"
      ) {
        return;
      }

      dispatchToSession({ questionId, type: "answerStarted" });

      // The answer is done once it's saved; what it taught memory arrives after, as its notice.
      const result = await streamLessonQuestionAnswerRequest({
        connection,
        onChunk: (chunk) => dispatchToSession({ chunk, questionId, type: "answerChunkReceived" }),
        onSaved: () => dispatchToSession({ questionId, type: "answerCompleted" }),
        questionId,
      });

      if (result.status === "error") {
        await reconcileAnswerFailure({
          context,
          questionId,
          reason: result.error,
          type: "answerFailed",
        });

        return;
      }

      dispatchToSession({ questionId, type: "answerCompleted" });

      if (result.data.memoryChanges.length > 0) {
        dispatchToSession({
          changes: result.data.memoryChanges,
          questionId,
          type: "memoryUpdated",
        });
      }
    },
    [connection, dispatchToContext, getState, reconcileAnswerFailure],
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

      await streamAnswer({ context: state.context, questionId });
    },
    [canAskQuestions, state.activeQuestionId, state.context, state.questions, streamAnswer],
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

      if (result.data.status === "running") {
        // The server only reclaims abandoned generations and rejects ones still in progress.
        await streamAnswer({ context: state.context, questionId });
        return;
      }

      dispatch({ questions: [result.data], type: "latestThreadReconciled" });
    },
    [
      connection,
      canAskQuestions,
      dispatch,
      state.activeQuestionId,
      state.context,
      state.questions,
      streamAnswer,
    ],
  );

  return { checkAnswer, retryAnswer, streamAnswer };
}

"use client";

import { type CreateLessonQuestionInput } from "@zoonk/core/lesson-questions/contract";
import { type PlayerQuestionContext } from "@zoonk/player/provider";
import { type Dispatch, useCallback, useRef } from "react";
import { createLessonQuestionRequest } from "./lesson-question-api";
import { getLessonQuestionContextInput } from "./lesson-question-request";
import { type LessonQuestionAction, type LessonQuestionState } from "./lesson-question-state";
import { doesLessonQuestionBlockNewQuestion } from "./lesson-question-status";

type PendingQuestionCreateRequest = {
  input: Omit<CreateLessonQuestionInput, "requestId">;
  requestId: string;
};

function shouldGenerateAnswer(status: "pending" | "running" | "completed" | "failed") {
  return status === "pending" || status === "failed";
}

function getQuestionCreateRequest({
  context,
  lessonSteps,
  pendingRequest,
  question,
}: {
  context: PlayerQuestionContext;
  lessonSteps: readonly { id: string }[];
  pendingRequest: PendingQuestionCreateRequest | null;
  question: string;
}): PendingQuestionCreateRequest {
  if (pendingRequest) {
    return pendingRequest;
  }

  return {
    input: {
      context: getLessonQuestionContextInput({
        context,
        lessonStepIds: lessonSteps.map((step) => step.id),
      }),
      question,
    },
    requestId: crypto.randomUUID(),
  };
}

export function useSendLessonQuestion({
  dispatch,
  isAuthenticated,
  lessonId,
  lessonSteps,
  reconcileThread,
  state,
  streamAnswer,
}: {
  dispatch: Dispatch<LessonQuestionAction>;
  isAuthenticated: boolean;
  lessonId: string;
  lessonSteps: readonly { id: string }[];
  reconcileThread: () => Promise<boolean>;
  state: LessonQuestionState;
  streamAnswer: (questionId: string) => Promise<void>;
}) {
  const createRequestInFlight = useRef(false);
  const pendingCreateRequest = useRef<PendingQuestionCreateRequest | null>(null);

  const hasBlockingQuestion = state.questions.some(doesLessonQuestionBlockNewQuestion);

  const submitQuestion = useCallback(
    async ({
      context,
      question,
      retryUnresolved,
    }: {
      context: PlayerQuestionContext;
      question: string;
      retryUnresolved: boolean;
    }) => {
      const unresolvedRequest = retryUnresolved ? pendingCreateRequest.current : null;

      if (
        !isAuthenticated ||
        (!question && !unresolvedRequest) ||
        (!retryUnresolved && pendingCreateRequest.current) ||
        state.activeQuestionId ||
        createRequestInFlight.current ||
        state.isCreating ||
        hasBlockingQuestion
      ) {
        return;
      }

      createRequestInFlight.current = true;
      dispatch({ type: "questionCreateStarted" });

      const request = getQuestionCreateRequest({
        context,
        lessonSteps,
        pendingRequest: unresolvedRequest,
        question,
      });

      const input = { ...request.input, requestId: request.requestId };
      pendingCreateRequest.current = request;
      const result = await createLessonQuestionRequest({ input, lessonId });
      createRequestInFlight.current = false;

      if (result.status === "error") {
        if (result.error.kind !== "unknown") {
          pendingCreateRequest.current = null;
        }

        if (result.error.kind === "conflict" && (await reconcileThread())) {
          return;
        }

        dispatch({ reason: result.error, type: "questionCreateFailed" });
        return;
      }

      pendingCreateRequest.current = null;
      dispatch({ question: result.data, type: "questionCreated" });

      if (shouldGenerateAnswer(result.data.status)) {
        await streamAnswer(result.data.id);
      }
    },
    [
      dispatch,
      hasBlockingQuestion,
      isAuthenticated,
      lessonId,
      lessonSteps,
      reconcileThread,
      state.activeQuestionId,
      state.isCreating,
      streamAnswer,
    ],
  );

  const send = useCallback(
    async () =>
      submitQuestion({
        context: state.context,
        question: state.draft.trim(),
        retryUnresolved: true,
      }),
    [state.context, state.draft, submitQuestion],
  );

  const sendPrepared = useCallback(
    async ({ context, question }: { context: PlayerQuestionContext; question: string }) =>
      submitQuestion({ context, question: question.trim(), retryUnresolved: false }),
    [submitQuestion],
  );

  const unresolvedQuestion = state.isCreating
    ? null
    : (pendingCreateRequest.current?.input.question ?? null);

  return { send, sendPrepared, unresolvedQuestion };
}

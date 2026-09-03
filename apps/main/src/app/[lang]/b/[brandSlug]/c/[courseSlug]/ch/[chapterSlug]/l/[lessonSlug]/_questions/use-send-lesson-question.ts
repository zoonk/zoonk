"use client";

import {
  type CreateLessonQuestionInput,
  type LessonQuestionResource,
} from "@zoonk/core/lesson-questions/contract";
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
  requestId,
}: {
  context: PlayerQuestionContext;
  lessonSteps: readonly { id: string }[];
  pendingRequest: PendingQuestionCreateRequest | null;
  question: string;
  requestId?: string;
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
    requestId: requestId ?? crypto.randomUUID(),
  };
}

export function useSendLessonQuestion({
  canAskQuestions,
  dispatch,
  lessonId,
  lessonSteps,
  reconcileThread,
  state,
  streamAnswer,
}: {
  canAskQuestions: boolean;
  dispatch: Dispatch<LessonQuestionAction>;
  lessonId: string;
  lessonSteps: readonly { id: string }[];
  reconcileThread: () => Promise<boolean>;
  state: LessonQuestionState;
  streamAnswer: (questionId: string) => Promise<void>;
}) {
  const createRequestInFlight = useRef(false);
  const pendingCreateRequest = useRef<PendingQuestionCreateRequest | null>(null);

  const threadBlocksNewQuestion = state.questions.some((question) =>
    doesLessonQuestionBlockNewQuestion(question),
  );

  const submitQuestion = useCallback(
    async ({
      authoritativeQuestions,
      context,
      question,
      requestId,
      retryUnresolved,
    }: {
      authoritativeQuestions?: LessonQuestionResource[];
      context: PlayerQuestionContext;
      question: string;
      requestId?: string;
      retryUnresolved: boolean;
    }) => {
      const unresolvedRequest = retryUnresolved ? pendingCreateRequest.current : null;

      const blocksNewQuestion =
        authoritativeQuestions?.some((candidate) =>
          doesLessonQuestionBlockNewQuestion(candidate),
        ) ?? threadBlocksNewQuestion;

      if (
        !canAskQuestions ||
        (!question && !unresolvedRequest) ||
        (!retryUnresolved && pendingCreateRequest.current) ||
        state.activeQuestionId ||
        createRequestInFlight.current ||
        state.isCreating ||
        blocksNewQuestion
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
        requestId,
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
      canAskQuestions,
      dispatch,
      lessonId,
      lessonSteps,
      reconcileThread,
      state.activeQuestionId,
      state.isCreating,
      streamAnswer,
      threadBlocksNewQuestion,
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
    async ({
      context,
      question,
      questions,
      requestId,
    }: {
      context: PlayerQuestionContext;
      question: string;
      questions: LessonQuestionResource[];
      requestId: string;
    }) =>
      submitQuestion({
        authoritativeQuestions: questions,
        context,
        question: question.trim(),
        requestId,
        retryUnresolved: false,
      }),
    [submitQuestion],
  );

  const unresolvedQuestion = state.isCreating
    ? null
    : (pendingCreateRequest.current?.input.question ?? null);

  return { send, sendPrepared, unresolvedQuestion };
}

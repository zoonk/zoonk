"use client";

import {
  type CreateLessonQuestionInput,
  type LessonQuestionResource,
} from "@zoonk/core/lesson-questions/contract";
import { type Dispatch, useCallback, useRef } from "react";
import { type PlayerQuestionContext } from "../player-context";
import { type LessonQuestionConnection, createLessonQuestionRequest } from "./lesson-question-api";
import { getLessonQuestionContextInput } from "./lesson-question-request";
import { getLessonQuestionScope } from "./lesson-question-scope";
import { type LessonQuestionSessionAction } from "./lesson-question-sessions";
import { type LessonQuestionState } from "./lesson-question-state";
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
  connection,
  canAskQuestions,
  dispatchToContext,
  getState,
  lessonId,
  lessonSteps,
  reconcileThread,
  state,
  streamAnswer,
}: {
  connection: LessonQuestionConnection;
  canAskQuestions: boolean;
  dispatchToContext: Dispatch<LessonQuestionSessionAction>;
  getState: (context: PlayerQuestionContext) => LessonQuestionState;
  lessonId: string;
  lessonSteps: readonly { id: string }[];
  reconcileThread: (context: PlayerQuestionContext) => Promise<boolean>;
  state: LessonQuestionState;
  streamAnswer: (input: { context: PlayerQuestionContext; questionId: string }) => Promise<void>;
}) {
  const createRequestsInFlight = useRef(new Set<string>());
  const pendingCreateRequests = useRef(new Map<string, PendingQuestionCreateRequest>());

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
      const scope = getLessonQuestionScope(context);
      const currentState = getState(context);

      const dispatch = (action: LessonQuestionSessionAction["action"]) =>
        dispatchToContext({ action, context });

      const pendingRequest = pendingCreateRequests.current.get(scope) ?? null;
      const unresolvedRequest = retryUnresolved ? pendingRequest : null;

      const blocksNewQuestion =
        authoritativeQuestions?.some((candidate) =>
          doesLessonQuestionBlockNewQuestion(candidate),
        ) ?? currentState.questions.some(doesLessonQuestionBlockNewQuestion);

      if (
        !canAskQuestions ||
        (!question && !unresolvedRequest) ||
        (!retryUnresolved && pendingRequest) ||
        currentState.activeQuestionId ||
        createRequestsInFlight.current.has(scope) ||
        currentState.isCreating ||
        blocksNewQuestion
      ) {
        return;
      }

      createRequestsInFlight.current.add(scope);
      dispatch({ type: "questionCreateStarted" });

      const request = getQuestionCreateRequest({
        context,
        lessonSteps,
        pendingRequest: unresolvedRequest,
        question,
        requestId,
      });

      const input = { ...request.input, requestId: request.requestId };
      pendingCreateRequests.current.set(scope, request);
      const result = await createLessonQuestionRequest({ connection, input, lessonId });
      createRequestsInFlight.current.delete(scope);

      if (result.status === "error") {
        if (result.error.kind !== "unknown") {
          pendingCreateRequests.current.delete(scope);
        }

        if (result.error.kind === "conflict" && (await reconcileThread(context))) {
          return;
        }

        dispatch({ reason: result.error, type: "questionCreateFailed" });
        return;
      }

      pendingCreateRequests.current.delete(scope);
      dispatch({ question: result.data, type: "questionCreated" });

      if (shouldGenerateAnswer(result.data.status)) {
        await streamAnswer({ context, questionId: result.data.id });
      }
    },
    [
      connection,
      canAskQuestions,
      dispatchToContext,
      getState,
      lessonId,
      lessonSteps,
      reconcileThread,
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
    : (pendingCreateRequests.current.get(getLessonQuestionScope(state.context))?.input.question ??
      null);

  return { send, sendPrepared, unresolvedQuestion };
}

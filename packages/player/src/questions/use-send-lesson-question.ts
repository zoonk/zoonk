"use client";

import {
  type CreateLessonQuestionInput,
  type TutorTarget,
} from "@zoonk/core/lesson-questions/contract";
import { type Dispatch, useCallback, useRef, useState } from "react";
import { type LessonQuestionConnection, createLessonQuestionRequest } from "./lesson-question-api";
import { type LessonQuestionContext } from "./lesson-question-context";
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
  lessonStepIds,
  pendingRequest,
  question,
  suggested,
}: {
  context: LessonQuestionContext;
  lessonStepIds: readonly string[];
  pendingRequest: PendingQuestionCreateRequest | null;
  question: string;
  suggested: boolean;
}): PendingQuestionCreateRequest {
  if (pendingRequest) {
    return pendingRequest;
  }

  return {
    input: {
      context: getLessonQuestionContextInput({ context, lessonStepIds: [...lessonStepIds] }),
      question,
      ...(suggested && { suggested: true as const }),
    },
    requestId: crypto.randomUUID(),
  };
}

export function useSendLessonQuestion({
  connection,
  canAskQuestions,
  dispatchToContext,
  getState,
  target,
  lessonStepIds,
  reconcileThread,
  state,
  streamAnswer,
}: {
  connection: LessonQuestionConnection;
  canAskQuestions: boolean;
  dispatchToContext: Dispatch<LessonQuestionSessionAction>;
  getState: (context: LessonQuestionContext) => LessonQuestionState;
  target: TutorTarget;
  lessonStepIds: readonly string[];
  reconcileThread: (context: LessonQuestionContext) => Promise<boolean>;
  state: LessonQuestionState;
  streamAnswer: (input: { context: LessonQuestionContext; questionId: string }) => Promise<void>;
}) {
  const createRequestsInFlight = useRef(new Set<string>());
  const pendingCreateRequests = useRef(new Map<string, PendingQuestionCreateRequest>());
  /** The ref gates requests immediately; render reads an immutable state snapshot. */
  const [pendingRequestSnapshot, setPendingRequestSnapshot] = useState(
    new Map<string, PendingQuestionCreateRequest>(),
  );

  const submitQuestion = useCallback(
    async ({
      context,
      question,
      suggested,
    }: {
      context: LessonQuestionContext;
      question: string;
      /** The learner sent a suggested question unchanged. */
      suggested: boolean;
    }) => {
      const scope = getLessonQuestionScope(context);
      const currentState = getState(context);

      const dispatch = (action: LessonQuestionSessionAction["action"]) =>
        dispatchToContext({ action, context });

      const pendingRequest = pendingCreateRequests.current.get(scope) ?? null;
      const blocksNewQuestion = currentState.questions.some(doesLessonQuestionBlockNewQuestion);

      if (
        !canAskQuestions ||
        (!question && !pendingRequest) ||
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
        lessonStepIds,
        pendingRequest,
        question,
        suggested,
      });

      const input = { ...request.input, requestId: request.requestId };
      pendingCreateRequests.current.set(scope, request);
      setPendingRequestSnapshot(new Map(pendingCreateRequests.current));
      const result = await createLessonQuestionRequest({ connection, input, target });
      createRequestsInFlight.current.delete(scope);

      if (result.status === "error") {
        if (result.error.kind !== "unknown") {
          pendingCreateRequests.current.delete(scope);
          setPendingRequestSnapshot(new Map(pendingCreateRequests.current));
        }

        if (result.error.kind === "conflict" && (await reconcileThread(context))) {
          return;
        }

        dispatch({ reason: result.error, type: "questionCreateFailed" });
        return;
      }

      pendingCreateRequests.current.delete(scope);
      setPendingRequestSnapshot(new Map(pendingCreateRequests.current));
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
      target,
      lessonStepIds,
      reconcileThread,
      streamAnswer,
    ],
  );

  const send = useCallback(async () => {
    const question = state.draft.trim();

    await submitQuestion({
      context: state.context,
      question,
      suggested: question === state.suggestion,
    });
  }, [state.context, state.draft, state.suggestion, submitQuestion]);

  /** Sends one of the tutor's suggested questions right away, as offered. */
  const sendSuggestion = useCallback(
    (question: string) => submitQuestion({ context: state.context, question, suggested: true }),
    [state.context, submitQuestion],
  );

  const unresolvedQuestion = state.isCreating
    ? null
    : (pendingRequestSnapshot.get(getLessonQuestionScope(state.context))?.input.question ?? null);

  return { send, sendSuggestion, unresolvedQuestion };
}

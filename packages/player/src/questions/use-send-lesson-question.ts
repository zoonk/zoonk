"use client";

import {
  type CreateLessonQuestionInput,
  type LessonScreenSuggestion,
  type TutorTarget,
} from "@zoonk/core/lesson-questions/contract";
import { type MissionMomentView } from "@zoonk/core/sessions/completion-contract";
import { type Dispatch, useCallback, useRef, useState } from "react";
import { type LessonQuestionConnection, createLessonQuestionRequest } from "./lesson-question-api";
import { type LessonQuestionContext } from "./lesson-question-context";
import { getLessonQuestionContextInput } from "./lesson-question-request";
import { getLessonQuestionScope } from "./lesson-question-scope";
import { type LessonQuestionSessionAction } from "./lesson-question-sessions";
import { type LessonQuestionState, type OfferedSuggestion } from "./lesson-question-state";
import { doesLessonQuestionBlockNewQuestion } from "./lesson-question-status";
import { preloadTutorMarkdown } from "./tutor-markdown-preload";

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
  suggestion,
}: {
  context: LessonQuestionContext;
  lessonStepIds: readonly string[];
  pendingRequest: PendingQuestionCreateRequest | null;
  question: string;
  suggestion?: LessonScreenSuggestion;
}): PendingQuestionCreateRequest {
  if (pendingRequest) {
    return pendingRequest;
  }

  return {
    input: {
      context: getLessonQuestionContextInput({ context, lessonStepIds: [...lessonStepIds] }),
      question,
      ...(suggestion && { suggestion }),
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
  onMissionMoment,
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
  /** What each question did to the day's missions, null when it completed none. */
  onMissionMoment?: (moment: MissionMomentView | null) => void;
  reconcileThread: (context: LessonQuestionContext) => Promise<boolean>;
  state: LessonQuestionState;
  streamAnswer: (input: { context: LessonQuestionContext; questionId: string }) => Promise<void>;
}) {
  const createRequestsInFlight = useRef(new Set<string>());
  /** A question whose answer never came back, sent again with its request id to resolve it. */
  const [pendingRequests, setPendingRequests] = useState(
    new Map<string, PendingQuestionCreateRequest>(),
  );

  const submitQuestion = useCallback(
    async ({
      context,
      question,
      suggestion,
    }: {
      context: LessonQuestionContext;
      question: string;
      /** The lesson screen suggestion the learner sent unchanged. */
      suggestion?: LessonScreenSuggestion;
    }) => {
      const scope = getLessonQuestionScope(context);
      const currentState = getState(context);

      const dispatch = (action: LessonQuestionSessionAction["action"]) =>
        dispatchToContext({ action, context });

      const pendingRequest = pendingRequests.get(scope) ?? null;
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
      // The answer's renderer loads while the question is sent and the answer is written.
      preloadTutorMarkdown();
      dispatch({ type: "questionCreateStarted" });

      const request = getQuestionCreateRequest({
        context,
        lessonStepIds,
        pendingRequest,
        question,
        suggestion,
      });

      const input = { ...request.input, requestId: request.requestId };
      setPendingRequests((current) => new Map(current).set(scope, request));
      const result = await createLessonQuestionRequest({ connection, input, target });
      createRequestsInFlight.current.delete(scope);

      if (result.status !== "error" || result.error.kind !== "unknown") {
        setPendingRequests((current) => new Map([...current].filter(([key]) => key !== scope)));
      }

      if (result.status === "error") {
        if (result.error.kind === "conflict" && (await reconcileThread(context))) {
          return;
        }

        dispatch({ reason: result.error, type: "questionCreateFailed" });
        return;
      }

      dispatch({ question: result.data, type: "questionCreated" });

      onMissionMoment?.(result.data.missionMoment);

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
      onMissionMoment,
      pendingRequests,
      reconcileThread,
      streamAnswer,
    ],
  );

  const send = useCallback(async () => {
    const question = state.draft.trim();

    await submitQuestion({
      context: state.context,
      question,
      suggestion: question === state.suggestion?.question ? state.suggestion.suggestion : undefined,
    });
  }, [state.context, state.draft, state.suggestion, submitQuestion]);

  /** Sends one of the tutor's suggested questions right away, as offered. */
  const sendSuggestion = useCallback(
    ({ question, suggestion }: OfferedSuggestion) =>
      submitQuestion({ context: state.context, question, suggestion }),
    [state.context, submitQuestion],
  );

  const unresolvedQuestion = state.isCreating
    ? null
    : (pendingRequests.get(getLessonQuestionScope(state.context))?.input.question ?? null);

  return { ask: submitQuestion, send, sendSuggestion, unresolvedQuestion };
}

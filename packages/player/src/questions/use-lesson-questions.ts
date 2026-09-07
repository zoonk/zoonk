"use client";

import { safeAsync } from "@zoonk/utils/error";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  type PlayerQuestionContext,
  type PlayerQuestionSupport,
  usePlayerRuntime,
  usePlayerViewer,
} from "../player-context";
import { usePlayerQuestionContext } from "../use-player-question-context";
import { type LessonQuestionConnection } from "./lesson-question-api";
import { getAnswerExplanationRequestId } from "./lesson-question-request";
import { getLessonQuestionScope } from "./lesson-question-scope";
import { type LessonQuestionState } from "./lesson-question-state";
import { useLessonQuestionAnswers } from "./use-lesson-question-answers";
import { useLessonQuestionRecovery } from "./use-lesson-question-recovery";
import { useLessonQuestionSessions } from "./use-lesson-question-sessions";
import { useLessonQuestionThread } from "./use-lesson-question-thread";
import { useSendLessonQuestion } from "./use-send-lesson-question";

type UseLessonQuestionsInput = { connection: LessonQuestionConnection; lessonId: string };

export type LessonQuestionController = {
  changeDraft: (draft: string) => void;
  checkAnswer: (questionId: string) => Promise<void>;
  close: () => void;
  copy: (text: string) => Promise<void>;
  load: () => Promise<boolean>;
  loadEarlier: () => Promise<void>;
  questionSupport: PlayerQuestionSupport;
  retryAnswer: (questionId: string) => Promise<void>;
  send: () => Promise<void>;
  state: LessonQuestionState;
  unresolvedQuestion: string | null;
};

export function useLessonQuestions({
  connection,
  lessonId,
}: UseLessonQuestionsInput): LessonQuestionController {
  const activeContext = usePlayerQuestionContext();
  const { state: playerState } = usePlayerRuntime();
  const { isAuthenticated } = usePlayerViewer();
  const lessonSteps = playerState.steps;
  const { state, dispatch, dispatchToContext, getState } = useLessonQuestionSessions(activeContext);
  const canAskQuestions = isAuthenticated;
  const canExplainAnswer = !state.activeQuestionId && !state.isCreating;

  const { load, loadEarlier, loadThread, reconcileLatestThread } = useLessonQuestionThread({
    canAskQuestions,
    connection,
    dispatch,
    dispatchToContext,
    getState,
    lessonId,
    state,
  });

  const preloadedScopes = useRef(new Set<string>());
  const openedScopes = useRef(new Set<string>());

  useEffect(() => {
    const scope = getLessonQuestionScope(activeContext);

    if (canAskQuestions && !preloadedScopes.current.has(scope)) {
      preloadedScopes.current.add(scope);
      void loadThread(activeContext);
    }
  }, [activeContext, canAskQuestions, loadThread]);

  const open = useCallback(
    (context: PlayerQuestionContext) => {
      dispatchToContext({ action: { context, type: "open" }, context });

      const scope = getLessonQuestionScope(context);
      const needsRefresh = openedScopes.current.has(scope) || !preloadedScopes.current.has(scope);
      openedScopes.current.add(scope);

      if (canAskQuestions && needsRefresh) {
        void loadThread(context);
      }
    },
    [canAskQuestions, dispatchToContext, loadThread],
  );

  const close = useCallback(() => dispatch({ type: "close" }), [dispatch]);

  const changeDraft = useCallback(
    (draft: string) => dispatch({ draft, type: "draftChanged" }),
    [dispatch],
  );

  const { checkAnswer, retryAnswer, streamAnswer } = useLessonQuestionAnswers({
    canAskQuestions,
    connection,
    dispatch,
    dispatchToContext,
    getState,
    state,
  });

  const { send, sendPrepared, unresolvedQuestion } = useSendLessonQuestion({
    canAskQuestions,
    connection,
    dispatchToContext,
    getState,
    lessonId,
    lessonSteps,
    reconcileThread: reconcileLatestThread,
    state,
    streamAnswer,
  });

  const resumeAnswer = useCallback(
    (questionId: string) => streamAnswer({ context: state.context, questionId }),
    [state.context, streamAnswer],
  );

  useLessonQuestionRecovery({
    canAskQuestions,
    connection,
    dispatch,
    state,
    streamAnswer: resumeAnswer,
  });

  const explainAnswer = useCallback(
    async ({ context, question }: { context: PlayerQuestionContext; question: string }) => {
      if (!canExplainAnswer) {
        return;
      }

      dispatchToContext({ action: { context, type: "open" }, context });
      dispatchToContext({ action: { draft: question, type: "draftChanged" }, context });
      openedScopes.current.add(getLessonQuestionScope(context));

      if (!canAskQuestions) {
        return;
      }

      const [questions, requestId] = await Promise.all([
        loadThread(context),
        getAnswerExplanationRequestId({
          context,
          lessonStepIds: lessonSteps.map((step) => step.id),
          question,
        }),
      ]);

      if (!questions) {
        return;
      }

      await sendPrepared({ context, question, questions, requestId });
    },
    [canAskQuestions, canExplainAnswer, dispatchToContext, lessonSteps, loadThread, sendPrepared],
  );

  const copy = useCallback(
    async (text: string) => {
      const { error } = await safeAsync(() => navigator.clipboard.writeText(text));
      dispatch({ type: error ? "copyFailed" : "copied" });
    },
    [dispatch],
  );

  const questionSupport = useMemo<PlayerQuestionSupport>(
    () => ({
      canExplainAnswer,
      interactionState: state.isOpen ? "paused" : "active",
      onAskQuestion: open,
      onExplainAnswer: (input) => void explainAnswer(input),
    }),
    [canExplainAnswer, explainAnswer, open, state.isOpen],
  );

  return {
    changeDraft,
    checkAnswer,
    close,
    copy,
    load,
    loadEarlier,
    questionSupport,
    retryAnswer,
    send,
    state,
    unresolvedQuestion,
  };
}

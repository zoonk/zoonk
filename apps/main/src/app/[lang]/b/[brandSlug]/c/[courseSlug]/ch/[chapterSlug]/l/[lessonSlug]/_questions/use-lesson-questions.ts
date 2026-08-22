"use client";

import { type PlayerQuestionContext, type PlayerQuestionSupport } from "@zoonk/player/provider";
import { safeAsync } from "@zoonk/utils/error";
import { useCallback, useMemo, useReducer } from "react";
import {
  type LessonQuestionApiError,
  getLessonQuestionThreadRequest,
  streamLessonQuestionAnswerRequest,
} from "./lesson-question-api";
import {
  INITIAL_LESSON_QUESTION_STATE,
  type LessonQuestionState,
  lessonQuestionReducer,
} from "./lesson-question-state";
import {
  doesLessonQuestionBlockNewQuestion,
  hasOtherAnswerInProgress,
} from "./lesson-question-status";
import { useLessonQuestionRecovery } from "./use-lesson-question-recovery";
import { useLessonQuestionThread } from "./use-lesson-question-thread";
import { useSendLessonQuestion } from "./use-send-lesson-question";

type UseLessonQuestionsInput = {
  isAuthenticated: boolean;
  lessonId: string;
  lessonSteps: readonly { id: string }[];
};

export type LessonQuestionController = {
  changeDraft: (draft: string) => void;
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
  isAuthenticated,
  lessonId,
  lessonSteps,
}: UseLessonQuestionsInput): LessonQuestionController {
  const [state, dispatch] = useReducer(lessonQuestionReducer, INITIAL_LESSON_QUESTION_STATE);

  const { load, loadEarlier, loadThread, reconcileLatestThread } = useLessonQuestionThread({
    dispatch,
    lessonId,
    state,
  });

  const open = useCallback(
    (context: PlayerQuestionContext) => {
      dispatch({ context, type: "open" });

      if (isAuthenticated && !state.activeQuestionId && !state.isCreating) {
        void load();
      }
    },
    [isAuthenticated, load, state.activeQuestionId, state.isCreating],
  );

  const close = useCallback(() => dispatch({ type: "close" }), []);

  const changeDraft = useCallback((draft: string) => dispatch({ draft, type: "draftChanged" }), []);

  const reconcileAnswerFailure = useCallback(
    async ({ questionId, reason }: { questionId: string; reason: LessonQuestionApiError }) => {
      const result = await getLessonQuestionThreadRequest({ lessonId });

      if (result.status === "error") {
        dispatch({ questionId, reason, type: "answerFailed" });
        return;
      }

      const thread = result.data;
      const questions = thread?.questions ?? [];
      const question = questions.find((candidate) => candidate.id === questionId);

      if (!question || question.status === "pending") {
        dispatch({ questionId, reason, type: "answerFailed" });
        return;
      }

      dispatch({ questions, type: "latestThreadReconciled" });

      if (question.status === "failed") {
        dispatch({ questionId, reason, type: "answerFailed" });
      }
    },
    [lessonId],
  );

  const streamAnswer = useCallback(
    async (questionId: string) => {
      dispatch({ questionId, type: "answerStarted" });

      const result = await streamLessonQuestionAnswerRequest({
        onChunk: (chunk) => dispatch({ chunk, questionId, type: "answerChunkReceived" }),
        questionId,
      });

      if (result.status === "error") {
        await reconcileAnswerFailure({ questionId, reason: result.error });
        return;
      }

      dispatch({ questionId, type: "answerCompleted" });
    },
    [reconcileAnswerFailure],
  );

  const { send, sendPrepared, unresolvedQuestion } = useSendLessonQuestion({
    dispatch,
    isAuthenticated,
    lessonId,
    lessonSteps,
    reconcileThread: reconcileLatestThread,
    state,
    streamAnswer,
  });

  useLessonQuestionRecovery({ dispatch, isAuthenticated, lessonId, state, streamAnswer });

  const explainAnswer = useCallback(
    async ({ context, question }: { context: PlayerQuestionContext; question: string }) => {
      dispatch({ context, type: "open" });
      dispatch({ draft: question, type: "draftChanged" });

      if (!isAuthenticated) {
        return;
      }

      const questions = await loadThread();

      if (
        !questions ||
        questions.some((candidate) => doesLessonQuestionBlockNewQuestion(candidate))
      ) {
        return;
      }

      await sendPrepared({ context, question });
    },
    [isAuthenticated, loadThread, sendPrepared],
  );

  const retryAnswer = useCallback(
    async (questionId: string) => {
      const question = state.questions.find((candidate) => candidate.id === questionId);

      if (
        state.activeQuestionId ||
        !question ||
        (question.status !== "failed" && question.status !== "running") ||
        hasOtherAnswerInProgress({ questionId, questions: state.questions })
      ) {
        return;
      }

      await streamAnswer(questionId);
    },
    [state.activeQuestionId, state.questions, streamAnswer],
  );

  const copy = useCallback(async (text: string) => {
    const { error } = await safeAsync(() => navigator.clipboard.writeText(text));
    dispatch({ type: error ? "copyFailed" : "copied" });
  }, []);

  const questionSupport = useMemo<PlayerQuestionSupport>(
    () => ({
      interactionState: state.isOpen ? "paused" : "active",
      onAskQuestion: open,
      onExplainAnswer: (input) => void explainAnswer(input),
    }),
    [explainAnswer, open, state.isOpen],
  );

  return {
    changeDraft,
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

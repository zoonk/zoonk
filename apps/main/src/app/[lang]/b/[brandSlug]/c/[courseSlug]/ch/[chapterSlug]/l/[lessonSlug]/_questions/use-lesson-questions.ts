"use client";

import { type PlayerQuestionContext, type PlayerQuestionSupport } from "@zoonk/player/provider";
import { safeAsync } from "@zoonk/utils/error";
import { useCallback, useMemo, useReducer } from "react";
import {
  INITIAL_LESSON_QUESTION_STATE,
  type LessonQuestionState,
  lessonQuestionReducer,
} from "./lesson-question-state";
import { useLessonQuestionAnswers } from "./use-lesson-question-answers";
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
  isAuthenticated,
  lessonId,
  lessonSteps,
}: UseLessonQuestionsInput): LessonQuestionController {
  const [state, dispatch] = useReducer(lessonQuestionReducer, INITIAL_LESSON_QUESTION_STATE);
  const canAskQuestions = isAuthenticated;
  const canExplainAnswer = !state.activeQuestionId && !state.isCreating;

  const { load, loadEarlier, loadThread, reconcileLatestThread } = useLessonQuestionThread({
    canAskQuestions,
    dispatch,
    lessonId,
    state,
  });

  const open = useCallback(
    (context: PlayerQuestionContext) => {
      dispatch({ context, type: "open" });

      if (canAskQuestions && !state.activeQuestionId && !state.isCreating) {
        void load();
      }
    },
    [canAskQuestions, load, state.activeQuestionId, state.isCreating],
  );

  const close = useCallback(() => dispatch({ type: "close" }), []);

  const changeDraft = useCallback((draft: string) => dispatch({ draft, type: "draftChanged" }), []);

  const { checkAnswer, retryAnswer, streamAnswer } = useLessonQuestionAnswers({
    canAskQuestions,
    dispatch,
    state,
  });

  const { send, sendPrepared, unresolvedQuestion } = useSendLessonQuestion({
    canAskQuestions,
    dispatch,
    lessonId,
    lessonSteps,
    reconcileThread: reconcileLatestThread,
    state,
    streamAnswer,
  });

  useLessonQuestionRecovery({ canAskQuestions, dispatch, state, streamAnswer });

  const explainAnswer = useCallback(
    async ({ context, question }: { context: PlayerQuestionContext; question: string }) => {
      if (!canExplainAnswer) {
        return;
      }

      dispatch({ context, type: "open" });
      dispatch({ draft: question, type: "draftChanged" });

      if (!canAskQuestions) {
        return;
      }

      const questions = await loadThread();

      if (!questions) {
        return;
      }

      await sendPrepared({ context, question, questions });
    },
    [canAskQuestions, canExplainAnswer, loadThread, sendPrepared],
  );

  const copy = useCallback(async (text: string) => {
    const { error } = await safeAsync(() => navigator.clipboard.writeText(text));
    dispatch({ type: error ? "copyFailed" : "copied" });
  }, []);

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

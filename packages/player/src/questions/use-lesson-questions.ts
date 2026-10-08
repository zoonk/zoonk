"use client";

import { type TutorTarget } from "@zoonk/core/lesson-questions/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { useCallback, useEffect, useRef } from "react";
import { type LessonQuestionConnection } from "./lesson-question-api";
import { type LessonQuestionContext } from "./lesson-question-context";
import { getLessonQuestionScope } from "./lesson-question-scope";
import { type LessonQuestionState } from "./lesson-question-state";
import { useLessonQuestionAnswers } from "./use-lesson-question-answers";
import { useLessonQuestionRecovery } from "./use-lesson-question-recovery";
import {
  type LessonQuestionThreadPage,
  useLessonQuestionSessions,
} from "./use-lesson-question-sessions";
import { useLessonQuestionThread } from "./use-lesson-question-thread";
import { useSendLessonQuestion } from "./use-send-lesson-question";

/**
 * What the host tells the tutor: where the learner is, whether they may ask (signed-in learners,
 * not visitors or guests), and a lesson's steps in the order they see them. A player loads the
 * thread about the screen in view ahead of time; a screen's "Ask" loads it when opened (`preload`).
 */
export type LessonQuestionHost = {
  activeContext: LessonQuestionContext;
  canAskQuestions: boolean;
  /**
   * The thread as the page read it on the server: it shows at once, and the tutor still reads it
   * again in the background for anything newer.
   */
  initialThread?: LessonQuestionThreadPage | null;
  lessonStepIds: readonly string[];
  /**
   * The conversation is a page of its own (the buddy's), always on screen, not a sheet the learner
   * opens: an answer still being written elsewhere is followed as soon as it shows.
   */
  page?: boolean;
  preload?: boolean;
};

type UseLessonQuestionsInput = LessonQuestionHost & {
  connection: LessonQuestionConnection;
  target: TutorTarget;
};

export type LessonQuestionController = {
  /** The learner answered a plan change an answer proposed (Apply, Not now, Undo). */
  answerPlanChange: (change: PlanChangeView) => void;
  canAskQuestions: boolean;
  changeDraft: (draft: string) => void;
  checkAnswer: (questionId: string) => Promise<void>;
  /** Puts one of the tutor's suggested questions in the composer. */
  chooseSuggestion: (question: string) => void;
  close: () => void;
  load: () => Promise<boolean>;
  loadEarlier: () => Promise<void>;
  open: (context: LessonQuestionContext) => void;
  retryAnswer: (questionId: string) => Promise<void>;
  send: () => Promise<void>;
  /** Sends one of the tutor's suggested questions right away. */
  sendSuggestion: (question: string) => Promise<void>;
  state: LessonQuestionState;
  unresolvedQuestion: string | null;
};

export function useLessonQuestions({
  activeContext,
  canAskQuestions,
  connection,
  initialThread = null,
  lessonStepIds,
  page = false,
  preload = true,
  target,
}: UseLessonQuestionsInput): LessonQuestionController {
  const { state, dispatch, dispatchToContext, getState } = useLessonQuestionSessions({
    activeContext,
    initialThread,
  });

  const { load, loadEarlier, loadThread, reconcileLatestThread } = useLessonQuestionThread({
    canAskQuestions,
    connection,
    dispatch,
    dispatchToContext,
    getState,
    state,
    target,
  });

  const preloadedScopes = useRef(new Set<string>());
  const openedScopes = useRef(new Set<string>());

  useEffect(() => {
    const scope = getLessonQuestionScope(activeContext);

    if (preload && canAskQuestions && !preloadedScopes.current.has(scope)) {
      preloadedScopes.current.add(scope);
      void loadThread(activeContext);
    }
  }, [activeContext, canAskQuestions, loadThread, preload]);

  const open = useCallback(
    (context: LessonQuestionContext) => {
      dispatchToContext({ action: { context, type: "open" }, context });

      const scope = getLessonQuestionScope(context);

      const needsRefresh =
        openedScopes.current.has(scope) ||
        !preloadedScopes.current.has(scope) ||
        getState(context).error === "load";

      openedScopes.current.add(scope);

      if (canAskQuestions && needsRefresh) {
        // A press replayed at hydration can open the sheet before the preload effect runs; this
        // load counts as the preload, so the effect doesn't fetch the thread a second time.
        preloadedScopes.current.add(scope);
        void loadThread(context);
      }
    },
    [canAskQuestions, dispatchToContext, getState, loadThread],
  );

  const close = useCallback(() => dispatch({ type: "close" }), [dispatch]);

  const changeDraft = useCallback(
    (draft: string) => dispatch({ draft, type: "draftChanged" }),
    [dispatch],
  );

  const chooseSuggestion = useCallback(
    (question: string) => dispatch({ question, type: "suggestionChosen" }),
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

  const answerPlanChange = useCallback(
    (change: PlanChangeView) => dispatch({ change, type: "planChangeAnswered" }),
    [dispatch],
  );

  const { send, sendSuggestion, unresolvedQuestion } = useSendLessonQuestion({
    canAskQuestions,
    connection,
    dispatchToContext,
    getState,
    lessonStepIds,
    reconcileThread: reconcileLatestThread,
    state,
    streamAnswer,
    target,
  });

  const resumeAnswer = useCallback(
    (questionId: string) => streamAnswer({ context: state.context, questionId }),
    [state.context, streamAnswer],
  );

  useLessonQuestionRecovery({
    canAskQuestions,
    connection,
    dispatch,
    isShown: page || state.isOpen,
    state,
    streamAnswer: resumeAnswer,
  });

  return {
    answerPlanChange,
    canAskQuestions,
    changeDraft,
    checkAnswer,
    chooseSuggestion,
    close,
    load,
    loadEarlier,
    open,
    retryAnswer,
    send,
    sendSuggestion,
    state,
    unresolvedQuestion,
  };
}

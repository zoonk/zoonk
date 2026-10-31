"use client";

import {
  type LessonScreenSuggestion,
  type LessonTutorSuggestion,
  type TutorTarget,
} from "@zoonk/core/lesson-questions/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { type MissionMomentView } from "@zoonk/core/sessions/completion-contract";
import { preloadTutorCards } from "@zoonk/learn/tutor-cards";
import { useCallback, useEffect, useRef } from "react";
import { type LessonQuestionConnection } from "./lesson-question-api";
import { type LessonQuestionContext } from "./lesson-question-context";
import { getLessonQuestionScope } from "./lesson-question-scope";
import { type LessonQuestionState, type OfferedSuggestion } from "./lesson-question-state";
import { preloadTutorMarkdown } from "./tutor-markdown-preload";
import { useLessonQuestionAnswers } from "./use-lesson-question-answers";
import { useLessonQuestionRecovery } from "./use-lesson-question-recovery";
import {
  type LessonQuestionThreadPage,
  useLessonQuestionSessions,
} from "./use-lesson-question-sessions";
import { useLessonQuestionThread } from "./use-lesson-question-thread";
import { useSendLessonQuestion } from "./use-send-lesson-question";

export type LessonQuestionHost = {
  activeContext: LessonQuestionContext;
  canAskQuestions: boolean;
  initialThread?: LessonQuestionThreadPage | null;
  lessonStepIds: readonly string[];
  onMissionMoment?: (moment: MissionMomentView | null) => void;
  page?: boolean;
  preload?: boolean;
  suggestions?: readonly LessonTutorSuggestion[];
};

const NO_SUGGESTIONS: readonly LessonTutorSuggestion[] = [];

type UseLessonQuestionsInput = LessonQuestionHost & {
  connection: LessonQuestionConnection;
  target: TutorTarget;
};

type LessonQuestionAsk = {
  context: LessonQuestionContext;
  question: string;
  suggestion?: LessonScreenSuggestion;
};

export type LessonQuestionController = {
  answerPlanChange: (change: PlanChangeView) => void;
  ask: (question: LessonQuestionAsk) => Promise<void>;
  canAskQuestions: boolean;
  changeDraft: (draft: string) => void;
  checkAnswer: (questionId: string) => Promise<void>;
  chooseSuggestion: (suggestion: OfferedSuggestion) => void;
  close: () => void;
  load: () => Promise<boolean>;
  loadEarlier: () => Promise<void>;
  open: (context: LessonQuestionContext, options?: { keepDraft?: boolean }) => void;
  retryAnswer: (questionId: string) => Promise<void>;
  send: () => Promise<void>;
  sendSuggestion: (suggestion: OfferedSuggestion) => Promise<void>;
  state: LessonQuestionState;
  suggestions: readonly LessonTutorSuggestion[];
  unresolvedQuestion: string | null;
};

export function useLessonQuestions({
  activeContext,
  canAskQuestions,
  connection,
  initialThread = null,
  lessonStepIds,
  onMissionMoment,
  page = false,
  preload = true,
  suggestions = NO_SUGGESTIONS,
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

  useEffect(() => {
    const answers = state.questions.flatMap(({ answer }) => (answer ? [answer] : []));

    if (answers.length > 0 || (page && canAskQuestions)) {
      preloadTutorMarkdown(answers);
    }

    if (state.questions.some(({ planChange, toolOffer }) => planChange || toolOffer)) {
      preloadTutorCards();
    }
  }, [canAskQuestions, page, state.questions]);

  const open = useCallback(
    (context: LessonQuestionContext, { keepDraft = false }: { keepDraft?: boolean } = {}) => {
      preloadTutorMarkdown();
      dispatchToContext({ action: { context, keepDraft, type: "open" }, context });

      const scope = getLessonQuestionScope(context);

      const needsRefresh =
        openedScopes.current.has(scope) ||
        !preloadedScopes.current.has(scope) ||
        getState(context).error === "load";

      openedScopes.current.add(scope);

      if (canAskQuestions && needsRefresh) {
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
    (suggestion: OfferedSuggestion) => dispatch({ suggestion, type: "suggestionChosen" }),
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

  const { ask, send, sendSuggestion, unresolvedQuestion } = useSendLessonQuestion({
    canAskQuestions,
    connection,
    dispatchToContext,
    getState,
    lessonStepIds,
    onMissionMoment,
    reconcileThread: reconcileLatestThread,
    state,
    streamAnswer,
    target,
  });

  useLessonQuestionRecovery({
    canAskQuestions,
    connection,
    dispatch,
    isShown: page || state.isOpen,
    state,
  });

  return {
    answerPlanChange,
    ask,
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
    suggestions,
    unresolvedQuestion,
  };
}

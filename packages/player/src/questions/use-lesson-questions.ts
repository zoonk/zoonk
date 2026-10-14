"use client";

import {
  type LessonScreenSuggestion,
  type LessonTutorSuggestion,
  type TutorTarget,
} from "@zoonk/core/lesson-questions/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { type MissionMomentView } from "@zoonk/core/sessions/completion-contract";
import { useCallback, useEffect, useRef } from "react";
import { type LessonQuestionConnection } from "./lesson-question-api";
import { type LessonQuestionContext } from "./lesson-question-context";
import { getLessonQuestionScope } from "./lesson-question-scope";
import { type LessonQuestionState, type OfferedSuggestion } from "./lesson-question-state";
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
  /** What a question just asked did to the day's missions (null: none), for the host to say. */
  onMissionMoment?: (moment: MissionMomentView | null) => void;
  /**
   * The conversation is a page of its own (the buddy's), always on screen, not a sheet the learner
   * opens: an answer still being written elsewhere is followed as soon as it shows.
   */
  page?: boolean;
  preload?: boolean;
  /**
   * The tutor's suggestions for a lesson's screens, worded by the server in the lesson's language
   * (`wordTutorSuggestions`): their chips read the words the question is stored with.
   */
  suggestions?: readonly LessonTutorSuggestion[];
};

const NO_SUGGESTIONS: readonly LessonTutorSuggestion[] = [];

type UseLessonQuestionsInput = LessonQuestionHost & {
  connection: LessonQuestionConnection;
  target: TutorTarget;
};

/** Where a question is going and what it says, sent at once (`ask`). */
type LessonQuestionAsk = {
  context: LessonQuestionContext;
  question: string;
  /** The lesson screen suggestion the learner sent unchanged. */
  suggestion?: LessonScreenSuggestion;
};

export type LessonQuestionController = {
  /** The learner answered a plan change an answer proposed (Apply, Not now, Undo). */
  answerPlanChange: (change: PlanChangeView) => void;
  /**
   * Sends a question about `context` at once, whatever the thread was last opened about: a
   * composer that is always on screen (the lesson's aside) asks about the screen in view.
   */
  ask: (question: LessonQuestionAsk) => Promise<void>;
  canAskQuestions: boolean;
  changeDraft: (draft: string) => void;
  checkAnswer: (questionId: string) => Promise<void>;
  /** Puts one of the tutor's suggested questions in the composer. */
  chooseSuggestion: (suggestion: OfferedSuggestion) => void;
  close: () => void;
  load: () => Promise<boolean>;
  loadEarlier: () => Promise<void>;
  /**
   * Shows the conversation about `context`. A draft written about something else is cleared,
   * unless the composer stays on screen whatever is open (`keepDraft`), where it's the learner's.
   */
  open: (context: LessonQuestionContext, options?: { keepDraft?: boolean }) => void;
  retryAnswer: (questionId: string) => Promise<void>;
  send: () => Promise<void>;
  /** Sends one of the tutor's suggested questions right away. */
  sendSuggestion: (suggestion: OfferedSuggestion) => Promise<void>;
  state: LessonQuestionState;
  /** The tutor's suggestions for a lesson's screens, as the host's payload words them. */
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

  const open = useCallback(
    (context: LessonQuestionContext, { keepDraft = false }: { keepDraft?: boolean } = {}) => {
      dispatchToContext({ action: { context, keepDraft, type: "open" }, context });

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

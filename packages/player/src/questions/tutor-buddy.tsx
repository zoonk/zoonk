"use client";

import { type LessonScreenSuggestion } from "@zoonk/core/lesson-questions/contract";
import { useTaskAsideShown } from "@zoonk/learn/task-header";
import { type TutorIdentity } from "@zoonk/learn/tutor-identity";
import { createContext, use, useMemo, useState } from "react";
import { type LessonQuestionContext } from "./lesson-question-context";
import { type LessonQuestionNavigation } from "./lesson-question-navigation";
import { LessonQuestionDrawer } from "./lesson-question-panel";
import { useLessonQuestionController } from "./lesson-question-provider";
import { type OfferedSuggestion } from "./lesson-question-state";
import { isSameDraftContext } from "./lesson-question-state-helpers";
import { doesLessonQuestionBlockNewQuestion } from "./lesson-question-status";

type TutorPresentation = "dock" | "drawer";

export type TutorBuddy = {
  ask: (question: OfferedSuggestion) => void;
  /** False for guests, who can't talk with the buddy. */
  canAsk: boolean;
  close: () => void;
  consulted: boolean;
  context: LessonQuestionContext;
  docked: boolean;
  drawerOpen: boolean;
  identity: TutorIdentity;
  missed: boolean;
  navigation: LessonQuestionNavigation;
  /** Fills the composer with the suggestion, for the learner to send. */
  open: (suggestion?: LessonScreenSuggestion) => void;
  /** Sends the suggestion at once, so the buddy starts answering as it opens; while an earlier question is unanswered, fills the composer instead. */
  openAndAsk: (suggestion: LessonScreenSuggestion) => void;
  /** What the screen's own button asks ("I didn't get this" asks the simpler take), so the aside's suggestions leave it out. */
  screenSuggestion?: LessonScreenSuggestion;
  suggests: boolean;
};

const TutorBuddyContext = createContext<TutorBuddy | null>(null);

export function useTutorBuddy(): TutorBuddy | null {
  return use(TutorBuddyContext);
}

export function TutorBuddyProvider({
  children,
  context,
  identity,
  missed,
  navigation,
  quote,
  screenSuggestion,
  suggests,
  visit,
}: Pick<TutorBuddy, "identity" | "missed" | "navigation" | "screenSuggestion" | "suggests"> & {
  children: React.ReactNode;
  context: LessonQuestionContext | null;
  quote: React.ReactNode;
  visit: string;
}) {
  const controller = useLessonQuestionController();
  const asideShown = useTaskAsideShown();

  const [shown, setShown] = useState<{ presentation: TutorPresentation | null; visit: string }>({
    presentation: null,
    visit,
  });

  if (shown.visit !== visit) {
    setShown({ presentation: null, visit });
  }

  const { canAskQuestions, chooseSuggestion, close, open, state, suggestions, unresolvedQuestion } =
    controller;

  const askAbout = controller.ask;
  const docked = state.isOpen && shown.presentation === "dock";
  const drawerOpen = state.isOpen && shown.presentation === "drawer";
  const consulted = shown.presentation !== null || state.questions.length > 0;

  const buddy = useMemo<TutorBuddy | null>(() => {
    if (!context) {
      return null;
    }

    const show = (suggestion?: LessonScreenSuggestion) => {
      setShown({ presentation: asideShown ? "dock" : "drawer", visit });
      open(context, { keepDraft: asideShown });
      return suggestions.find(({ id }) => id === suggestion);
    };

    return {
      ask: ({ question, suggestion }) => {
        if (!docked || !isSameDraftContext({ current: state.context, next: context })) {
          setShown({ presentation: "dock", visit });
          open(context, { keepDraft: true });
        }

        void askAbout({ context, question, suggestion });
      },
      canAsk: canAskQuestions,
      close,
      consulted,
      context,
      docked,
      drawerOpen,
      identity,
      missed,
      navigation,
      open: (suggestion) => {
        const offered = show(suggestion);

        if (offered) {
          chooseSuggestion({ question: offered.label, suggestion: offered.id });
        }
      },
      openAndAsk: (suggestion) => {
        const offered = show(suggestion);

        if (!offered) {
          return;
        }

        const isWaiting =
          isSameDraftContext({ current: state.context, next: context }) &&
          (state.creating !== null ||
            unresolvedQuestion !== null ||
            state.questions.some(doesLessonQuestionBlockNewQuestion));

        if (isWaiting) {
          chooseSuggestion({ question: offered.label, suggestion: offered.id });
          return;
        }

        void askAbout({ context, question: offered.label, suggestion: offered.id });
      },
      screenSuggestion,
      suggests: suggests && state.questions.length === 0,
    };
  }, [
    askAbout,
    asideShown,
    canAskQuestions,
    chooseSuggestion,
    close,
    consulted,
    context,
    docked,
    drawerOpen,
    identity,
    missed,
    navigation,
    open,
    screenSuggestion,
    state.context,
    state.creating,
    state.questions,
    suggestions,
    suggests,
    unresolvedQuestion,
    visit,
  ]);

  return (
    <TutorBuddyContext value={buddy}>
      {children}
      {context && (
        <LessonQuestionDrawer
          identity={identity}
          navigation={navigation}
          open={drawerOpen}
          quote={quote}
        />
      )}
    </TutorBuddyContext>
  );
}

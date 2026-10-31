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

type TutorPresentation = "dock" | "drawer";

export type TutorBuddy = {
  ask: (question: OfferedSuggestion) => void;
  close: () => void;
  consulted: boolean;
  context: LessonQuestionContext;
  docked: boolean;
  drawerOpen: boolean;
  identity: TutorIdentity;
  missed: boolean;
  navigation: LessonQuestionNavigation;
  open: (suggestion?: LessonScreenSuggestion) => void;
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
  suggests,
  visit,
}: Pick<TutorBuddy, "identity" | "missed" | "navigation" | "suggests"> & {
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

  const { chooseSuggestion, close, open, state, suggestions } = controller;
  const askAbout = controller.ask;
  const docked = state.isOpen && shown.presentation === "dock";
  const drawerOpen = state.isOpen && shown.presentation === "drawer";
  const consulted = shown.presentation !== null || state.questions.length > 0;

  const buddy = useMemo<TutorBuddy | null>(() => {
    if (!context) {
      return null;
    }

    return {
      ask: ({ question, suggestion }) => {
        if (!docked || !isSameDraftContext({ current: state.context, next: context })) {
          setShown({ presentation: "dock", visit });
          open(context, { keepDraft: true });
        }

        void askAbout({ context, question, suggestion });
      },
      close,
      consulted,
      context,
      docked,
      drawerOpen,
      identity,
      missed,
      navigation,
      open: (suggestion) => {
        setShown({ presentation: asideShown ? "dock" : "drawer", visit });
        open(context, { keepDraft: asideShown });
        const offered = suggestions.find(({ id }) => id === suggestion);

        if (offered) {
          chooseSuggestion({ question: offered.label, suggestion: offered.id });
        }
      },
      suggests: suggests && state.questions.length === 0,
    };
  }, [
    askAbout,
    asideShown,
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
    state.context,
    state.questions.length,
    suggestions,
    suggests,
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

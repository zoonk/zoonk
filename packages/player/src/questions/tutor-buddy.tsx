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

/**
 * Where the conversation shows: docked in the task's aside from `lg`, beside what it's about, or
 * in a drawer over the task on phones and tablets in portrait. Chosen when it opens.
 */
type TutorPresentation = "dock" | "drawer";

/**
 * The learner's buddy for where they are (a lesson's screen or the answer just checked, a run's
 * question), and ways to ask it about it.
 */
export type TutorBuddy = {
  /**
   * Sends a question from the aside (its composer or a suggestion) and shows the conversation
   * there, about where the learner is, whatever the conversation last opened about.
   */
  ask: (question: OfferedSuggestion) => void;
  /** Back to the task from the conversation docked in the aside. */
  close: () => void;
  /**
   * The learner has turned to the buddy about where they are: opened its conversation on this
   * visit, or asked about it before.
   */
  consulted: boolean;
  context: LessonQuestionContext;
  /** The conversation shows in the aside, beside the task, whose keys keep working. */
  docked: boolean;
  /** The conversation shows in a drawer over the task, which pauses its keys. */
  drawerOpen: boolean;
  identity: TutorIdentity;
  /** A wrong answer's result is on screen, when asking helps most: the bar says the buddy's name. */
  missed: boolean;
  /** The host's links (a sign-up, plans), for the conversation wherever it shows. */
  navigation: LessonQuestionNavigation;
  /**
   * Opens the conversation, docked in the aside on a wide screen and in a drawer otherwise, with
   * one of a lesson's suggestions ready to send, in the words its chip reads.
   */
  open: (suggestion?: LessonScreenSuggestion) => void;
  /** The aside offers two of the buddy's suggested questions over its composer. */
  suggests: boolean;
};

const TutorBuddyContext = createContext<TutorBuddy | null>(null);

/** The learner's buddy for where they are; null without a tutor, or between a run's questions. */
export function useTutorBuddy(): TutorBuddy | null {
  return use(TutorBuddyContext);
}

/**
 * The buddy inside a tutor host (`LessonQuestionHostProvider`), about `context` (null asks nothing):
 * its conversation in a drawer that quotes what's asked about, or docked in the aside from `lg`.
 * The conversation shows on the visit the learner opened it on (a lesson's screen or a run's
 * question, by its place in the lesson or run) until they move to another one, so a question
 * coming back opens fresh.
 */
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
  /** What's asked about, quoted as the drawer's first line. */
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
        // A draft in the aside's composer is the learner's, so it stays until it's sent.
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
      suggests,
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

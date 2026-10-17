"use client";

import { type LessonScreenSuggestion } from "@zoonk/core/lesson-questions/contract";
import { useTaskAsideShown } from "@zoonk/learn/task-header";
import { type TutorIdentity, useTutorIdentity } from "@zoonk/learn/tutor-identity";
import { createContext, use, useMemo, useState } from "react";
import { type LessonQuestionContext } from "../../questions/lesson-question-context";
import { type LessonQuestionNavigation } from "../../questions/lesson-question-navigation";
import { LessonQuestionDrawer } from "../../questions/lesson-question-panel";
import {
  LessonQuestionHostProvider,
  useLessonQuestionController,
} from "../../questions/lesson-question-provider";
import { type OfferedSuggestion } from "../../questions/lesson-question-state";
import { isSameDraftContext } from "../../questions/lesson-question-state-helpers";
import { useLessonPlayer, useLessonPlayerConfig } from "../lesson-player-context";
import { LessonInteractionProvider } from "../lesson-player-interaction";
import { type LessonTutorConfig } from "./lesson-tutor-context";
import { TutorQuote } from "./tutor-quote";

/**
 * Where the conversation shows: a drawer over the lesson on phones and tablets in portrait, or
 * docked in the lesson's aside from `lg`, beside the screen it's about. Chosen when it opens.
 */
type TutorPresentation = "dock" | "drawer";

/** The learner's buddy in the lesson: who it is, and a way to ask it about where they are. */
type LessonBuddyTutor = {
  /**
   * Sends a question about where the learner is from the lesson's aside (its composer or a
   * suggestion), and shows the conversation there.
   */
  ask: (question: OfferedSuggestion) => void;
  /** Back to the lesson from the conversation docked in the aside. */
  close: () => void;
  /** Where the learner is, as the tutor sees it: the screen in view, or the answer just checked. */
  context: LessonQuestionContext;
  /**
   * The conversation shows in the aside, beside the lesson, whose keys keep working; a drawer over
   * the lesson pauses them instead.
   */
  docked: boolean;
  identity: TutorIdentity;
  /** The host's links (a sign-up, plans), for the conversation wherever it shows. */
  navigation: LessonQuestionNavigation;
  /**
   * Opens the conversation about where the learner is, docked in the aside on a wide screen and in
   * a drawer otherwise, with one of the lesson's `suggestions` ready to send, in the words its chip
   * reads.
   */
  open: (suggestion?: LessonScreenSuggestion) => void;
};

const LessonTutorContext = createContext<LessonBuddyTutor | null>(null);

/**
 * Where the learner is, as the tutor sees it: the lesson once it's done, the answer they just
 * checked while its result shows, or the screen in view. A hook's guess isn't an answer.
 */
function useTutorContext(): LessonQuestionContext {
  const { screen, state } = useLessonPlayer();
  const { step } = screen;
  const answer = step ? state.answers[step.id] : undefined;
  const showsResult = state.phase === "feedback" && Boolean(step && state.results[step.id]);

  return useMemo(() => {
    if (!step) {
      return { kind: "lesson" };
    }

    const where = { step: { id: step.id }, stepIndex: state.position };

    return showsResult && answer && answer.kind !== "hook"
      ? { kind: "answer", selectedAnswer: answer, ...where }
      : { kind: "step", ...where };
  }, [answer, showsResult, state.position, step]);
}

function TutorInteraction({
  children,
  identity,
  navigation,
}: {
  children: React.ReactNode;
  identity: TutorIdentity;
  navigation: LessonQuestionNavigation;
}) {
  const controller = useLessonQuestionController();
  const activeContext = useTutorContext();
  const asideShown = useTaskAsideShown();
  const [presentation, setPresentation] = useState<TutorPresentation>("drawer");
  const { chooseSuggestion, close, open, state, suggestions } = controller;
  const askAbout = controller.ask;
  const docked = state.isOpen && presentation === "dock";
  const inDrawer = state.isOpen && presentation === "drawer";

  const buddy = useMemo<LessonBuddyTutor>(
    () => ({
      ask: ({ question, suggestion }) => {
        // The conversation shows in the aside, about the screen in view; a draft in the aside's
        // composer is the learner's, so it stays until it's sent.
        if (!docked || !isSameDraftContext({ current: state.context, next: activeContext })) {
          setPresentation("dock");
          open(activeContext, { keepDraft: true });
        }

        void askAbout({ context: activeContext, question, suggestion });
      },
      close,
      context: activeContext,
      docked,
      identity,
      navigation,
      open: (suggestion) => {
        setPresentation(asideShown ? "dock" : "drawer");
        open(activeContext, { keepDraft: asideShown });
        const offered = suggestions.find(({ id }) => id === suggestion);

        if (offered) {
          chooseSuggestion({ question: offered.label, suggestion: offered.id });
        }
      },
    }),
    [
      activeContext,
      askAbout,
      asideShown,
      chooseSuggestion,
      close,
      docked,
      identity,
      navigation,
      open,
      state.context,
      suggestions,
    ],
  );

  return (
    <LessonTutorContext value={buddy}>
      <LessonInteractionProvider tutorOpen={inDrawer}>{children}</LessonInteractionProvider>
      <LessonQuestionDrawer
        identity={identity}
        navigation={navigation}
        open={inDrawer}
        quote={<TutorQuote />}
      />
    </LessonTutorContext>
  );
}

function LessonTutorHost({
  children,
  tutor,
}: {
  children: React.ReactNode;
  tutor: LessonTutorConfig;
}) {
  const { lesson } = useLessonPlayerConfig();
  const { state } = useLessonPlayer();
  const activeContext = useTutorContext();
  const identity = useTutorIdentity(tutor.buddy);

  // Every screen once, in lesson order: a question coming back at the end is still one screen.
  const lessonStepIds = useMemo(() => Object.keys(state.steps), [state.steps]);
  const target = useMemo(() => ({ kind: "lesson" as const, lessonId: lesson.id }), [lesson.id]);

  return (
    <LessonQuestionHostProvider
      connection={tutor.connection}
      host={{
        activeContext,
        canAskQuestions: tutor.canAsk,
        lessonStepIds,
        suggestions: tutor.suggestions,
      }}
      target={target}
    >
      <TutorInteraction identity={identity} navigation={tutor.navigation}>
        {children}
      </TutorInteraction>
    </LessonQuestionHostProvider>
  );
}

/**
 * The tutor in the step: the conversation about the screen in view or the answer just checked,
 * in a drawer that pauses the lesson's keys, or docked in the lesson's aside from `lg`. Without a
 * tutor from the host, the lesson plays without one.
 */
export function LessonTutor({
  children,
  tutor,
}: {
  children: React.ReactNode;
  tutor: LessonTutorConfig | undefined;
}) {
  if (!tutor) {
    return <LessonInteractionProvider>{children}</LessonInteractionProvider>;
  }

  return <LessonTutorHost tutor={tutor}>{children}</LessonTutorHost>;
}

/**
 * The learner's buddy in the lesson, to ask about where they are; null when the lesson has no
 * tutor.
 */
export function useLessonBuddy(): LessonBuddyTutor | null {
  return use(LessonTutorContext);
}

"use client";

import { type TutorIdentity, useTutorIdentity } from "@zoonk/learn/tutor-identity";
import { useMemo } from "react";
import { type LessonQuestionContext } from "../../questions/lesson-question-context";
import { type LessonQuestionNavigation } from "../../questions/lesson-question-navigation";
import {
  LessonQuestionHostProvider,
  useLessonQuestionController,
} from "../../questions/lesson-question-provider";
import { TutorBuddyProvider } from "../../questions/tutor-buddy";
import { isLanguageStep, isReadStep } from "../_utils/lesson-steps";
import { useLessonPlayer, useLessonPlayerConfig } from "../lesson-player-context";
import { LessonInteractionProvider } from "../lesson-player-interaction";
import { type PlayableLibraryStep } from "../lesson-player-types";
import { type LessonTutorConfig } from "./lesson-tutor-context";
import { TutorQuote } from "./tutor-quote";
import { useShowsMiss } from "./use-shows-miss";

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

/** A screen that teaches by reading (an explanation, a worked example, a hook's fact). */
function isTeachingRead(step: PlayableLibraryStep | null): boolean {
  return step !== null && !isLanguageStep(step) && isReadStep(step) && step.kind !== "summary";
}

/**
 * The buddy about the screen in view, by its place in the lesson, so a question coming back at the
 * end is another visit. The aside offers two questions over its composer after a wrong answer,
 * about it, and on a reading screen nothing was asked about yet, the lesson's own (simpler,
 * deeper).
 */
function LessonBuddy({
  children,
  identity,
  navigation,
}: {
  children: React.ReactNode;
  identity: TutorIdentity;
  navigation: LessonQuestionNavigation;
}) {
  const { screen, state } = useLessonPlayer();
  const { questions } = useLessonQuestionController().state;
  const context = useTutorContext();
  const missed = useShowsMiss();

  return (
    <TutorBuddyProvider
      context={context}
      identity={identity}
      missed={missed}
      navigation={navigation}
      quote={<TutorQuote />}
      suggests={missed || (isTeachingRead(screen.step) && questions.length === 0)}
      visit={`${state.position}:${screen.step?.id ?? ""}`}
    >
      {children}
    </TutorBuddyProvider>
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
      <LessonBuddy identity={identity} navigation={tutor.navigation}>
        {children}
      </LessonBuddy>
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
  const lesson = <LessonInteractionProvider>{children}</LessonInteractionProvider>;
  return tutor ? <LessonTutorHost tutor={tutor}>{lesson}</LessonTutorHost> : lesson;
}

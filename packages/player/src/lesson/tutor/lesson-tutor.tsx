"use client";

import { type TutorIdentity, useTutorIdentity } from "@zoonk/learn/tutor-identity";
import { useMemo } from "react";
import { type LessonQuestionContext } from "../../questions/lesson-question-context";
import { type LessonQuestionNavigation } from "../../questions/lesson-question-navigation";
import { LessonQuestionHostProvider } from "../../questions/lesson-question-provider";
import { TutorBuddyProvider } from "../../questions/tutor-buddy";
import { isLanguageStep, isReadStep } from "../_utils/lesson-steps";
import { useLessonPlayer, useLessonPlayerConfig } from "../lesson-player-context";
import { LessonInteractionProvider } from "../lesson-player-interaction";
import { type PlayableLibraryStep } from "../lesson-player-types";
import { type LessonTutorConfig } from "./lesson-tutor-context";
import { TutorQuote } from "./tutor-quote";
import { useShowsMiss } from "./use-shows-miss";

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

function isTeachingRead(step: PlayableLibraryStep | null): boolean {
  return step !== null && !isLanguageStep(step) && isReadStep(step) && step.kind !== "summary";
}

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
  const context = useTutorContext();
  const missed = useShowsMiss();

  return (
    <TutorBuddyProvider
      context={context}
      identity={identity}
      missed={missed}
      navigation={navigation}
      quote={<TutorQuote />}
      suggests={missed || isTeachingRead(screen.step)}
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

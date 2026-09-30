"use client";

import { createContext, use, useMemo } from "react";
import { type LessonQuestionContext } from "../../questions/lesson-question-context";
import { LessonQuestionSheet } from "../../questions/lesson-question-panel";
import {
  LessonQuestionHostProvider,
  useLessonQuestionController,
} from "../../questions/lesson-question-provider";
import { useLessonPlayer, useLessonPlayerConfig } from "../lesson-player-context";
import { LessonInteractionProvider } from "../lesson-player-interaction";
import { type LessonTutorConfig } from "./lesson-tutor-context";

const LessonTutorContext = createContext<(() => void) | null>(null);

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

function TutorInteraction({ children }: { children: React.ReactNode }) {
  const controller = useLessonQuestionController();
  const activeContext = useTutorContext();
  const { open } = controller;

  const openHere = useMemo(() => () => open(activeContext), [activeContext, open]);

  return (
    <LessonTutorContext value={openHere}>
      <LessonInteractionProvider tutorOpen={controller.state.isOpen}>
        {children}
      </LessonInteractionProvider>
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

  // Every screen once, in lesson order: a question coming back at the end is still one screen.
  const lessonStepIds = useMemo(() => Object.keys(state.steps), [state.steps]);
  const target = useMemo(() => ({ kind: "lesson" as const, lessonId: lesson.id }), [lesson.id]);

  return (
    <LessonQuestionHostProvider
      connection={tutor.connection}
      host={{ activeContext, canAskQuestions: tutor.canAsk, lessonStepIds }}
      target={target}
    >
      <TutorInteraction>{children}</TutorInteraction>
      <LessonQuestionSheet navigation={tutor.navigation} stepCount={state.queue.length} />
    </LessonQuestionHostProvider>
  );
}

/**
 * The tutor in the step: the questions sheet, asked about the screen in view or the answer just
 * checked, and pausing the lesson's keys while it's open. Without a tutor from the host, the lesson
 * plays without one.
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

/** Opens the tutor about where the learner is; null when the lesson has no tutor. */
export function useOpenTutor(): (() => void) | null {
  return use(LessonTutorContext);
}

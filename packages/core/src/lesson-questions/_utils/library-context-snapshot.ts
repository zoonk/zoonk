import "server-only";
import {
  type LessonQuestionStepContext,
  type LessonScopeContext,
} from "@zoonk/ai/tasks/lessons/question-context";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { findOpenedVersion, findPlayableLessonRow } from "../../lesson-player/_utils/lesson-rows";
import { loadPlayableSteps } from "../../lesson-player/_utils/load-playable-steps";
import { type LessonStepAnswer } from "../../lesson-player/contract";
import { gradeStepAnswer } from "../../lesson-player/grade-step-answer";
import { isAnswerableStep } from "../../lesson-player/lesson-run";
import { type PlayableLibraryStep } from "../../lesson-player/playable-lesson";
import { type LessonScopeContextInput } from "../contract";
import { type LibraryQuestionLesson } from "./question-access";

type SnapshotAnswer = NonNullable<LessonScopeContext["answer"]>;

function toStepContext({
  step,
  stepNumber,
}: {
  step: PlayableLibraryStep;
  stepNumber: number;
}): LessonQuestionStepContext {
  return {
    answerable: isAnswerableStep(step),
    content: "exercise" in step ? step.exercise : step.content,
    kind: step.kind,
    sentence: null,
    stepNumber,
    word: null,
  };
}

function getContextStepIds(context: LessonScopeContextInput): string[] {
  return context.kind === "lesson" ? (context.stepIds ?? []) : [context.stepId];
}

function getRequestedSteps({
  context,
  steps,
}: {
  context: LessonScopeContextInput;
  steps: PlayableLibraryStep[];
}): PlayableLibraryStep[] | null {
  const ids = getContextStepIds(context);

  if (new Set(ids).size !== ids.length || ids.some((id) => !isUuid(id))) {
    return null;
  }

  if (ids.length === 0) {
    return steps;
  }

  const byId = new Map(steps.map((step) => [step.id, step]));
  const requested = ids.flatMap((id) => byId.get(id) ?? []);

  return requested.length === ids.length ? requested : null;
}

/** Model-graded answers must use the recorded verdict the learner actually saw. */
async function getRecordedAnswer({
  answer,
  step,
  userId,
}: {
  answer: Extract<LessonStepAnswer, { kind: "spokenAnswer" | "typedAnswer" }>;
  step: PlayableLibraryStep;
  userId: string;
}): Promise<SnapshotAnswer | null> {
  const attempt = await prisma.attempt.findFirst({
    orderBy: { answeredAt: "desc" },
    select: { isCorrect: true },
    where: { stepId: step.id, userId },
  });

  if (!attempt) {
    return null;
  }

  const correctAnswer =
    (step.kind === "typedAnswer" && step.content.sampleAnswer) ||
    (step.kind === "spokenAnswer" && step.content.targetText) ||
    null;

  return {
    correctAnswer: attempt.isCorrect ? null : correctAnswer,
    feedback: null,
    isCorrect: attempt.isCorrect,
    selectedAnswer: answer.text,
  };
}

async function getAnswerContext({
  answer,
  language,
  step,
  userId,
}: {
  answer: LessonStepAnswer;
  language: string;
  step: PlayableLibraryStep;
  userId: string;
}): Promise<SnapshotAnswer | null> {
  if (answer.kind === "typedAnswer" || answer.kind === "spokenAnswer") {
    return getRecordedAnswer({ answer, step, userId });
  }

  const graded = gradeStepAnswer({ answer, language, step });

  return graded?.answerText
    ? {
        correctAnswer: graded.correctAnswer,
        feedback: graded.feedback,
        isCorrect: graded.isCorrect,
        selectedAnswer: graded.answerText,
      }
    : null;
}

function isGuess(step: PlayableLibraryStep): boolean {
  return step.kind === "hook" && step.content.variant === "guess";
}

function isTeachingStep(step: PlayableLibraryStep): boolean {
  return !isAnswerableStep(step) && !isGuess(step);
}

/**
 * A screen's question also gets the screens that teach its idea, often after it, so the tutor can
 * explain what they explain. Other questions and guesses stay out: they hold answers. Numbers follow
 * the lesson, since the client's number counts retried screens again.
 */
function getScreenSteps({
  activeStep,
  steps,
}: {
  activeStep: PlayableLibraryStep;
  steps: PlayableLibraryStep[];
}): Pick<LessonScopeContext, "lessonSteps" | "step"> {
  const numbered = steps.map((step, index) => ({
    active: step.id === activeStep.id,
    context: toStepContext({ step, stepNumber: index + 1 }),
    teaching: isTeachingStep(step),
  }));

  return {
    lessonSteps: numbered
      .filter(({ active, teaching }) => active || teaching)
      .map(({ context }) => context),
    step: numbered.find(({ active }) => active)?.context ?? null,
  };
}

function getLessonPlace(
  lesson: LibraryQuestionLesson,
): Pick<LessonScopeContext, "chapter" | "course" | "lesson"> {
  const chapter = lesson.homeChapter;
  const course = chapter?.homeCourse;

  return {
    chapter: { description: chapter?.description ?? null, title: chapter?.title ?? lesson.title },
    course: {
      description: course?.description ?? null,
      language: lesson.language,
      targetLanguage: lesson.targetLanguage,
      title: course?.title ?? chapter?.title ?? lesson.title,
    },
    lesson: {
      description: lesson.description,
      kind: "library",
      language: lesson.language,
      title: lesson.title,
    },
  };
}

export async function buildLibraryQuestionContextSnapshot({
  context,
  lesson,
  userId,
}: {
  context: LessonScopeContextInput;
  lesson: LibraryQuestionLesson;
  userId: string;
}) {
  // Use the learner's opened version even when a background check has replaced it.
  const version = await findOpenedVersion({
    lessonId: lesson.id,
    stepIds: getContextStepIds(context).filter((id) => isUuid(id)),
    userId,
  });

  const row = await findPlayableLessonRow({ lessonId: lesson.id, userId, version });

  if (!row) {
    return { status: "invalidContext" as const };
  }

  const lessonRows = await loadPlayableSteps({ lesson: row, rows: row.steps });
  const steps = getRequestedSteps({ context, steps: lessonRows });

  if (!steps) {
    return { status: "invalidContext" as const };
  }

  const activeStep = context.kind === "lesson" ? null : steps[0];

  const answer =
    context.kind === "answer" && activeStep
      ? await getAnswerContext({
          answer: context.answer,
          language: row.language,
          step: activeStep,
          userId,
        })
      : null;

  if (context.kind === "answer" && !answer) {
    return { status: "invalidContext" as const };
  }

  const contextSnapshot: LessonScopeContext = {
    ...getLessonPlace(lesson),
    answer,
    ...(activeStep
      ? getScreenSteps({ activeStep, steps: lessonRows })
      : {
          lessonSteps: steps.map((step, index) => toStepContext({ step, stepNumber: index + 1 })),
          step: null,
        }),
    scope: { kind: context.kind },
    version: 1,
  };

  return {
    contextSnapshot,
    status: "ready" as const,
    stepId: context.kind === "lesson" ? null : context.stepId,
    stepNumber: context.kind === "lesson" ? null : context.stepNumber,
  };
}

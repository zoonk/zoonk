import "server-only";
import {
  type LessonQuestionStepContext,
  type LessonScopeContext,
} from "@zoonk/ai/tasks/lessons/question-context";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { findOpenedVersion, findPlayableLessonRow } from "../../lesson-player/_utils/lesson-rows";
import { loadPlayableSteps } from "../../lesson-player/_utils/load-playable-steps";
import { type LessonStepAnswer, type PlayableLibraryStep } from "../../lesson-player/contract";
import { gradeStepAnswer } from "../../lesson-player/grade-step-answer";
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
    // A language exercise carries its word, sentence and options in today's exercise shape.
    content: "exercise" in step ? step.exercise : step.content,
    kind: step.kind,
    sentence: null,
    stepNumber,
    word: null,
  };
}

/** The steps the question is about, in the order the learner saw them. */
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

/**
 * Typed and spoken answers are graded by a model on the server, so their verdict is the one the
 * learner saw: their latest recorded answer to the step.
 */
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
  step,
  userId,
}: {
  answer: LessonStepAnswer;
  step: PlayableLibraryStep;
  userId: string;
}): Promise<SnapshotAnswer | null> {
  if (answer.kind === "typedAnswer" || answer.kind === "spokenAnswer") {
    return getRecordedAnswer({ answer, step, userId });
  }

  const graded = gradeStepAnswer({ answer, step });

  return graded?.answerText
    ? {
        correctAnswer: graded.correctAnswer,
        feedback: graded.feedback,
        isCorrect: graded.isCorrect,
        selectedAnswer: graded.answerText,
      }
    : null;
}

function getStepNumber({
  context,
  index,
}: {
  context: LessonScopeContextInput;
  index: number;
}): number {
  return context.kind === "lesson" ? index + 1 : context.stepNumber;
}

/**
 * Where the lesson sits: its home chapter and that chapter's course. A lesson outside any chapter
 * stands for both, so the tutor always has a topic to anchor to.
 */
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

/**
 * The tutor's view of a Library lesson, resolved on the server from the step ids the player sent:
 * the lesson and its home chapter and course, the steps in question with their content, and for an
 * answer, the verdict graded again from the stored step.
 */
export async function buildLibraryQuestionContextSnapshot({
  context,
  lesson,
  userId,
}: {
  context: LessonScopeContextInput;
  lesson: LibraryQuestionLesson;
  userId: string;
}) {
  // A learner asking about a screen of a version replaced while they played it asks about theirs.
  const version = await findOpenedVersion({
    lessonId: lesson.id,
    stepIds: getContextStepIds(context).filter((id) => isUuid(id)),
    userId,
  });

  const row = await findPlayableLessonRow({ lessonId: lesson.id, userId, version });

  if (!row) {
    return { status: "invalidContext" as const };
  }

  const steps = getRequestedSteps({
    context,
    steps: await loadPlayableSteps({ lesson: row, rows: row.steps }),
  });

  if (!steps) {
    return { status: "invalidContext" as const };
  }

  const lessonSteps = steps.map((step, index) =>
    toStepContext({ step, stepNumber: getStepNumber({ context, index }) }),
  );

  const activeStep = context.kind === "lesson" ? null : steps[0];

  const answer =
    context.kind === "answer" && activeStep
      ? await getAnswerContext({ answer: context.answer, step: activeStep, userId })
      : null;

  if (context.kind === "answer" && !answer) {
    return { status: "invalidContext" as const };
  }

  const contextSnapshot: LessonScopeContext = {
    ...getLessonPlace(lesson),
    answer,
    lessonSteps,
    scope: { kind: context.kind },
    step: context.kind === "lesson" ? null : (lessonSteps[0] ?? null),
    version: 1,
  };

  return {
    contextSnapshot,
    status: "ready" as const,
    stepId: context.kind === "lesson" ? null : context.stepId,
    stepNumber: context.kind === "lesson" ? null : context.stepNumber,
  };
}

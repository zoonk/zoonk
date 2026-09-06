import "server-only";
import {
  type LessonQuestionContextSnapshot,
  type LessonQuestionStepContext,
} from "@zoonk/ai/tasks/lessons/question";
import { getPublishedStepWhere, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { ANSWERABLE_STEP_KINDS } from "../../player/contracts/validate-answers";
import { isSupportedStepKind, parseStepContent } from "../../steps/contract/content";
import { type LessonQuestionContextInput } from "../contract";
import { getLessonQuestionAnswer } from "./answer-context";
import { type LessonQuestionAccessLesson } from "./question-access";
import { type LessonQuestionStep, lessonQuestionStepInclude } from "./question-step";

type SnapshotStep = { context: LessonQuestionStepContext; id: string };

function getRequestedStepIds(context: LessonQuestionContextInput): string[] {
  if (context.kind === "lesson") {
    return context.stepIds ?? [];
  }

  return [context.stepId];
}

function hasUniqueIds(ids: string[]): boolean {
  return new Set(ids).size === ids.length;
}

function getQuestionStepWhere({
  lesson,
  requestedStepIds,
}: {
  lesson: LessonQuestionAccessLesson;
  requestedStepIds: string[];
}) {
  const stepWhere = requestedStepIds.length > 0 ? { id: { in: requestedStepIds } } : {};

  if (lesson.kind !== "review") {
    return getPublishedStepWhere({ lessonWhere: { id: lesson.id }, stepWhere });
  }

  return getPublishedStepWhere({
    chapterWhere: { id: lesson.chapterId },
    lessonWhere: { kind: { not: "review" } },
    stepWhere: { ...stepWhere, kind: { in: [...ANSWERABLE_STEP_KINDS] } },
  });
}

function orderStepsByRequestedIds({
  requestedStepIds,
  steps,
}: {
  requestedStepIds: string[];
  steps: LessonQuestionStep[];
}): LessonQuestionStep[] {
  if (requestedStepIds.length === 0) {
    return steps;
  }

  const stepById = new Map(steps.map((step) => [step.id, step]));

  return requestedStepIds.flatMap((stepId) => {
    const step = stepById.get(stepId);
    return step ? [step] : [];
  });
}

/** Lesson length must not prevent asking questions; include all requested, authorized steps. */
async function getQuestionSteps({
  context,
  lesson,
}: {
  context: LessonQuestionContextInput;
  lesson: LessonQuestionAccessLesson;
}) {
  const requestedStepIds = getRequestedStepIds(context);

  if (!hasUniqueIds(requestedStepIds) || requestedStepIds.some((stepId) => !isUuid(stepId))) {
    return { status: "invalidContext" as const };
  }

  const steps = await prisma.step.findMany({
    include: lessonQuestionStepInclude,
    orderBy: [{ lesson: { position: "asc" } }, { position: "asc" }],
    where: getQuestionStepWhere({ lesson, requestedStepIds }),
  });

  if (requestedStepIds.length > 0 && steps.length !== requestedStepIds.length) {
    return { status: "invalidContext" as const };
  }

  return {
    requestedStepIds,
    status: "ready" as const,
    steps: orderStepsByRequestedIds({ requestedStepIds, steps }),
  };
}

function getWordContext(step: LessonQuestionStep): LessonQuestionStepContext["word"] {
  if (!step.word) {
    return null;
  }

  const userLanguage = step.chapterWord?.userLanguage;

  const pronunciation = step.word.pronunciations.find(
    (candidate) => candidate.userLanguage === userLanguage,
  );

  return {
    pronunciation: pronunciation?.pronunciation ?? null,
    romanization: step.word.romanization,
    translation: step.chapterWord?.translation ?? "",
    word: step.word.word,
  };
}

function getSentenceContext(step: LessonQuestionStep): LessonQuestionStepContext["sentence"] {
  if (!step.sentence) {
    return null;
  }

  return {
    explanation: step.chapterSentence?.explanation ?? null,
    romanization: step.sentence.romanization,
    sentence: step.sentence.sentence,
    translation: step.chapterSentence?.translation ?? "",
  };
}

function toSnapshotStep({
  step,
  stepNumber,
}: {
  step: LessonQuestionStep;
  stepNumber: number;
}): SnapshotStep | null {
  if (!isSupportedStepKind(step.kind)) {
    return null;
  }

  try {
    return {
      context: {
        content: parseStepContent(step.kind, step.content),
        kind: step.kind,
        sentence: getSentenceContext(step),
        stepNumber,
        word: getWordContext(step),
      },
      id: step.id,
    };
  } catch {
    return null;
  }
}

function getSnapshotStepNumber({
  context,
  index,
}: {
  context: LessonQuestionContextInput;
  index: number;
}): number {
  return context.kind === "lesson" ? index + 1 : context.stepNumber;
}

function isSnapshotStep(step: SnapshotStep | null): step is SnapshotStep {
  return step !== null;
}

function toSnapshotSteps({
  context,
  steps,
}: {
  context: LessonQuestionContextInput;
  steps: LessonQuestionStep[];
}): SnapshotStep[] {
  return steps
    .map((step, index) =>
      toSnapshotStep({ step, stepNumber: getSnapshotStepNumber({ context, index }) }),
    )
    .filter((step): step is SnapshotStep => isSnapshotStep(step));
}

function getActiveSnapshotStep({
  context,
  snapshotSteps,
}: {
  context: LessonQuestionContextInput;
  snapshotSteps: SnapshotStep[];
}): SnapshotStep | null {
  if (context.kind === "lesson") {
    return null;
  }

  return snapshotSteps.find((step) => step.id === context.stepId) ?? null;
}

async function getValidatedAnswerContext({
  context,
  rawSteps,
}: {
  context: LessonQuestionContextInput;
  rawSteps: LessonQuestionStep[];
}): Promise<NonNullable<LessonQuestionContextSnapshot["answer"]> | null | "invalid"> {
  if (context.kind !== "answer") {
    return null;
  }

  const rawStep = rawSteps.find((step) => step.id === context.stepId);

  if (!rawStep) {
    return "invalid";
  }

  return getLessonQuestionAnswer({ answer: context.answer, step: rawStep });
}

export async function buildLessonQuestionContextSnapshot({
  context,
  lesson,
}: {
  context: LessonQuestionContextInput;
  lesson: LessonQuestionAccessLesson;
}) {
  const stepsResult = await getQuestionSteps({ context, lesson });

  if (stepsResult.status !== "ready") {
    return stepsResult;
  }

  const snapshotSteps = toSnapshotSteps({ context, steps: stepsResult.steps });
  const activeStep = getActiveSnapshotStep({ context, snapshotSteps });

  if (context.kind !== "lesson" && !activeStep) {
    return { status: "invalidContext" as const };
  }

  if (
    stepsResult.requestedStepIds.length > 0 &&
    snapshotSteps.length !== stepsResult.requestedStepIds.length
  ) {
    return { status: "invalidContext" as const };
  }

  const validatedAnswer = await getValidatedAnswerContext({ context, rawSteps: stepsResult.steps });

  if (validatedAnswer === "invalid") {
    return { status: "invalidContext" as const };
  }

  const contextSnapshot: LessonQuestionContextSnapshot = {
    answer: context.kind === "answer" ? validatedAnswer : null,
    chapter: { description: lesson.chapter.description, title: lesson.chapter.title },
    course: {
      description: lesson.chapter.course.description,
      language: lesson.chapter.course.language,
      targetLanguage: lesson.chapter.course.targetLanguage,
      title: lesson.chapter.course.title,
    },
    lesson: {
      description: lesson.description,
      kind: lesson.kind,
      language: lesson.language,
      title: lesson.title,
    },
    lessonSteps: snapshotSteps.map((step) => step.context),
    scope: { kind: context.kind },
    step: activeStep?.context ?? null,
    version: 1,
  };

  return {
    contextSnapshot,
    status: "ready" as const,
    stepId: context.kind === "lesson" ? null : context.stepId,
    stepNumber: context.kind === "lesson" ? null : context.stepNumber,
  };
}

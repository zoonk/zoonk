import { type QuizQuestion } from "@zoonk/ai/tasks/lessons/core/quiz";
import { assertStepContent } from "@zoonk/core/steps/contract/content";
import { type StepImage } from "@zoonk/core/steps/contract/image";
import { prisma } from "@zoonk/db";
import { type LessonContext } from "../get-lesson-step";
import { type GeneratedLessonContent, type StaticLessonStep } from "./generated-lesson-content";
import { type StepRecord, addOptionIds } from "./save-lesson-content-helpers";

export type QuizQuestionWithUrls =
  | Exclude<QuizQuestion, { format: "selectImage" }>
  | (Extract<QuizQuestion, { format: "selectImage" }> & {
      options: (Extract<QuizQuestion, { format: "selectImage" }>["options"][number] & {
        url?: string;
      })[];
    });

function getOptionalStepImage(images: StepImage[] | undefined, index: number): StepImage | null {
  return images?.[index] ?? null;
}

function assertImageCount({
  images,
  stepCount,
}: {
  images: StepImage[] | undefined;
  stepCount: number;
}): void {
  if (images && images.length !== stepCount) {
    throw new Error("Generated image count does not match lesson step count");
  }
}

/**
 * Saves readable static steps used by explanation and tutorial lessons.
 */
export async function saveStaticLessonContent({
  context,
  images,
  steps,
}: {
  context: LessonContext;
  images?: StepImage[];
  steps: StaticLessonStep[];
}): Promise<void> {
  assertImageCount({ images, stepCount: steps.length });

  await prisma.step.createMany({
    data: steps.map((step, position) => {
      const image = getOptionalStepImage(images, position);

      return {
        content: assertStepContent("static", {
          ...(image ? { image } : {}),
          text: step.text,
          title: step.title,
          variant: "text",
        }),
        isPublished: true,
        kind: "static" as const,
        lessonId: context.id,
        position,
      };
    }),
  });
}

/**
 * Saves the scenario intro plus multiple-choice practice questions.
 */
export async function savePracticeLessonContent({
  content,
  context,
  images,
}: {
  content: Extract<GeneratedLessonContent, { kind: "practice" }>;
  context: LessonContext;
  images?: StepImage[];
}): Promise<void> {
  assertImageCount({ images, stepCount: content.steps.length + 1 });
  const scenarioImage = getOptionalStepImage(images, 0);

  const scenarioStep: StepRecord = {
    content: assertStepContent("static", {
      ...(scenarioImage ? { image: scenarioImage } : {}),
      text: content.scenario.text,
      title: content.scenario.title,
      variant: "intro",
    }),
    isPublished: true,
    kind: "static",
    lessonId: context.id,
    position: 0,
  };

  const questionSteps: StepRecord[] = content.steps.map((step, index) => {
    const image = getOptionalStepImage(images, index + 1);

    return {
      content: assertStepContent("multipleChoice", {
        context: step.context,
        ...(image ? { image } : {}),
        kind: "core",
        options: addOptionIds({ options: step.options }),
        question: step.question,
      }),
      isPublished: true,
      kind: "multipleChoice",
      lessonId: context.id,
      position: index + 1,
    };
  });

  await prisma.step.createMany({ data: [scenarioStep, ...questionSteps] });
}

/**
 * Converts generated quiz questions into player step records.
 */
export async function saveQuizLessonContent({
  context,
  questions,
}: {
  context: LessonContext;
  questions: QuizQuestionWithUrls[];
}): Promise<void> {
  await prisma.step.createMany({
    data: questions.map((question, position) => ({
      content: buildQuizStepContent(question),
      isPublished: true,
      kind: question.format,
      lessonId: context.id,
      position,
    })),
  });
}

/**
 * Adds runtime-only fields required by stored quiz step contracts.
 */
function buildQuizStepContent(question: QuizQuestionWithUrls) {
  if (question.format === "multipleChoice") {
    const { format, ...rawContent } = question;

    return assertStepContent(format, {
      ...rawContent,
      kind: "core",
      options: addOptionIds({ options: question.options }),
    });
  }

  if (question.format === "selectImage") {
    const { format, ...rawContent } = question;
    return assertStepContent(format, {
      ...rawContent,
      options: addOptionIds({ options: question.options }),
    });
  }

  const { format, ...rawContent } = question;
  return assertStepContent(format, rawContent);
}

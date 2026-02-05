import {
  type QuizQuestion,
  type SelectImageQuestion,
} from "@zoonk/ai/tasks/activities/core/explanation-quiz";
import { generateStepImage } from "@zoonk/core/steps/image";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

export type QuizQuestionWithUrls =
  | Exclude<QuizQuestion, SelectImageQuestion>
  | (Omit<SelectImageQuestion, "options"> & {
      options: SelectImageQuestion["options"][number] & { url?: string }[];
    });

export async function generateQuizImagesStep(
  activities: LessonActivity[],
  questions: QuizQuestion[],
): Promise<QuizQuestionWithUrls[]> {
  "use step";

  const activity = activities.find((a) => a.kind === "quiz");

  if (!activity || questions.length === 0) {
    return [];
  }

  // Query selectImage steps from DB for incremental resume
  const dbSteps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    select: { content: true, id: true },
    where: { activityId: activity.id, kind: "selectImage" },
  });

  if (dbSteps.length === 0) {
    // No selectImage questions - return questions as-is
    return questions;
  }

  await streamStatus({ status: "started", step: "generateQuizImages" });

  const orgSlug = activity.lesson.chapter.course.organization.slug;
  let hadFailure = false;

  // For each selectImage step, find options missing URLs, generate, update DB
  const stepResults = await Promise.allSettled(
    dbSteps.map(async (step) => {
      const content = step.content as { options: { prompt: string; url?: string }[] } & Record<
        string,
        unknown
      >;
      const missingIndices = content.options
        .map((o, i) => ({ index: i, option: o }))
        .filter(({ option }) => !option.url);

      if (missingIndices.length === 0) {
        return;
      }

      const results = await Promise.allSettled(
        missingIndices.map(({ option }) => generateStepImage({ orgSlug, prompt: option.prompt })),
      );

      const updatedOptions = [...content.options];
      let anyFailed = false;

      missingIndices.forEach(({ index }, resultIndex) => {
        const result = results[resultIndex];
        if (result?.status === "fulfilled" && !result.value.error) {
          updatedOptions[index] = { ...updatedOptions[index]!, url: result.value.data };
        } else {
          anyFailed = true;
        }
      });

      if (anyFailed) {
        hadFailure = true;
      }

      const { error } = await safeAsync(() =>
        prisma.step.update({
          data: { content: { ...content, options: updatedOptions } },
          where: { id: step.id },
        }),
      );

      if (error) {
        hadFailure = true;
      }
    }),
  );

  if (stepResults.some((r) => r.status === "rejected")) {
    hadFailure = true;
  }

  if (hadFailure) {
    await handleActivityFailureStep({ activityId: activity.id });
  }

  await streamStatus({ status: "completed", step: "generateQuizImages" });

  // Re-read DB to return current state
  const updatedSteps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    select: { content: true, kind: true },
    where: { activityId: activity.id },
  });

  return updatedSteps.map((s) => {
    const content = s.content as Record<string, unknown>;
    return { format: s.kind, ...content } as QuizQuestionWithUrls;
  });
}

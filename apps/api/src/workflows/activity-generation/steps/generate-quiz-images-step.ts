import {
  type QuizQuestion,
  type SelectImageQuestion,
} from "@zoonk/ai/tasks/activities/core/explanation-quiz";
import { generateStepImage } from "@zoonk/core/steps/image";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { isJsonObject, toRecord } from "@zoonk/utils/json";
import { streamStatus } from "../stream-status";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

export type QuizQuestionWithUrls =
  | Exclude<QuizQuestion, SelectImageQuestion>
  | (Omit<SelectImageQuestion, "options"> & {
      options: SelectImageQuestion["options"][number] & { url?: string }[];
    });

type SelectImageOption = { prompt: string; url?: string };

function parseSelectImageOptions(content: unknown): SelectImageOption[] | null {
  if (!isJsonObject(content)) {
    return null;
  }
  const { options } = content;
  if (!Array.isArray(options)) {
    return null;
  }
  return options.filter(
    (opt): opt is SelectImageOption => isJsonObject(opt) && typeof opt.prompt === "string",
  );
}

function toQuizQuestion(step: { content: unknown; kind: string }): QuizQuestionWithUrls {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- reconstructing QuizQuestion union from DB; kind discriminates the shape
  return { format: step.kind, ...toRecord(step.content) } as QuizQuestionWithUrls;
}

async function generateOptionImages(
  options: SelectImageOption[],
  orgSlug: string,
): Promise<{ hadFailure: boolean; updatedOptions: SelectImageOption[] }> {
  const results = await Promise.allSettled(
    options.map(({ prompt }) => generateStepImage({ orgSlug, prompt })),
  );

  const updatedOptions = options.map((option, index) => {
    const result = results[index];
    if (result?.status === "fulfilled" && !result.value.error) {
      return { ...option, url: result.value.data };
    }
    return option;
  });

  const hadFailure = results.some((result) => result.status === "rejected" || result.value.error);

  return { hadFailure, updatedOptions };
}

export async function generateQuizImagesStep(
  activities: LessonActivity[],
  questions: QuizQuestion[],
): Promise<QuizQuestionWithUrls[]> {
  "use step";

  const activity = findActivityByKind(activities, "quiz");

  if (!activity || questions.length === 0) {
    return [];
  }

  if (activity.generationStatus === "completed" || activity.generationStatus === "running") {
    return [];
  }

  const dbSteps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    select: { content: true, id: true },
    where: { activityId: activity.id, kind: "selectImage" },
  });

  if (dbSteps.length === 0) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- QuizQuestion is a subtype; url? is optional
    return questions as QuizQuestionWithUrls[];
  }

  await streamStatus({ status: "started", step: "generateQuizImages" });

  const orgSlug = activity.lesson.chapter.course.organization.slug;

  const stepResults = await Promise.allSettled(
    dbSteps.map(async (step) => {
      const options = parseSelectImageOptions(step.content);
      if (!options) {
        return { imageFailed: false, updateFailed: false };
      }

      const { hadFailure: imageFailed, updatedOptions } = await generateOptionImages(
        options,
        orgSlug,
      );

      const stepContent = toRecord(step.content);
      const { error } = await safeAsync(() =>
        prisma.step.update({
          data: { content: { ...stepContent, options: updatedOptions } },
          where: { id: step.id },
        }),
      );

      return { imageFailed, updateFailed: Boolean(error) };
    }),
  );

  const hadFailure = stepResults.some(
    (result) =>
      result.status === "rejected" ||
      (result.status === "fulfilled" && result.value?.imageFailed) ||
      (result.status === "fulfilled" && result.value?.updateFailed),
  );

  if (hadFailure) {
    await handleActivityFailureStep({ activityId: activity.id });
  }

  await streamStatus({ status: "completed", step: "generateQuizImages" });

  const updatedSteps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    select: { content: true, kind: true },
    where: { activityId: activity.id },
  });

  return updatedSteps.map((step) => toQuizQuestion(step));
}

import {
  type QuizQuestion,
  type SelectImageQuestion,
} from "@zoonk/ai/tasks/activities/core/explanation-quiz";
import { generateStepImage } from "@zoonk/core/steps/image";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { isJsonObject, toRecord } from "@zoonk/utils/json";
import { streamStatus } from "../stream-status";
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

async function generateMissingOptionImages(
  options: SelectImageOption[],
  orgSlug: string,
): Promise<{ hadFailure: boolean; updatedOptions: SelectImageOption[] }> {
  const missingIndices = options
    .map((opt, idx) => ({ index: idx, option: opt }))
    .filter(({ option }) => !option.url);

  if (missingIndices.length === 0) {
    return { hadFailure: false, updatedOptions: options };
  }

  const results = await Promise.allSettled(
    missingIndices.map(({ option }) => generateStepImage({ orgSlug, prompt: option.prompt })),
  );

  const updatedOptions = [...options];
  let hadFailure = false;

  missingIndices.forEach(({ index }, resultIndex) => {
    const result = results[resultIndex];
    if (result?.status === "fulfilled" && !result.value.error) {
      const existing = updatedOptions[index];
      updatedOptions[index] = {
        ...existing,
        prompt: existing?.prompt ?? "",
        url: result.value.data,
      };
    } else {
      hadFailure = true;
    }
  });

  return { hadFailure, updatedOptions };
}

export async function generateQuizImagesStep(
  activities: LessonActivity[],
  questions: QuizQuestion[],
): Promise<QuizQuestionWithUrls[]> {
  "use step";

  const activity = activities.find((act) => act.kind === "quiz");

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
    // No selectImage steps in DB - questions don't need URL enrichment
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- QuizQuestion is a subtype; url? is optional
    return questions as QuizQuestionWithUrls[];
  }

  await streamStatus({ status: "started", step: "generateQuizImages" });

  const orgSlug = activity.lesson.chapter.course.organization.slug;
  let hadFailure = false;

  const stepResults = await Promise.allSettled(
    dbSteps.map(async (step) => {
      const options = parseSelectImageOptions(step.content);
      if (!options) {
        return;
      }

      const { hadFailure: imageFailed, updatedOptions } = await generateMissingOptionImages(
        options,
        orgSlug,
      );

      if (imageFailed) {
        hadFailure = true;
      }

      // Only update if we had missing images
      if (options.some((opt) => !opt.url)) {
        const stepContent = toRecord(step.content);
        const { error } = await safeAsync(() =>
          prisma.step.update({
            data: { content: { ...stepContent, options: updatedOptions } },
            where: { id: step.id },
          }),
        );

        if (error) {
          hadFailure = true;
        }
      }
    }),
  );

  if (stepResults.some((result) => result.status === "rejected")) {
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

  return updatedSteps.map((step) => toQuizQuestion(step));
}

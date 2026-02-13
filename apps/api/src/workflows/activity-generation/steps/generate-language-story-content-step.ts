import {
  type WorkflowErrorReason,
  getAIResultErrorReason,
} from "@/workflows/_shared/stream-status";
import {
  type ActivityStoryLanguageSchema,
  generateActivityStoryLanguage,
} from "@zoonk/ai/tasks/activities/language/story";
import { assertStepContent } from "@zoonk/core/steps/content-contract";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { emptyToNull } from "@zoonk/utils/string";
import { z } from "zod";
import { streamError, streamStatus } from "../stream-status";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

const minimumLanguageStoryContentSchema = z.object({
  scenario: z.string().trim().min(1),
  steps: z
    .array(
      z.object({
        context: z.string().trim().min(1),
        contextRomanization: z.string().nullable(),
        contextTranslation: z.string().trim().min(1),
        options: z
          .array(
            z.object({
              feedback: z.string().trim().min(1),
              isCorrect: z.boolean(),
              text: z.string().trim().min(1),
              textRomanization: z.string().nullable(),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

function hasMinimumLanguageStoryContent(data: ActivityStoryLanguageSchema): boolean {
  return minimumLanguageStoryContentSchema.safeParse(data).success;
}

function buildLanguageStorySteps(activityId: bigint | number, data: ActivityStoryLanguageSchema) {
  const scenarioStep = {
    activityId,
    content: assertStepContent("static", {
      text: data.scenario,
      title: "Scenario",
      variant: "text",
    }),
    isPublished: true,
    kind: "static" as const,
    position: 0,
  };

  const storySteps = data.steps.map((step, index) => ({
    activityId,
    content: assertStepContent("multipleChoice", {
      context: step.context,
      contextRomanization: emptyToNull(step.contextRomanization),
      contextTranslation: step.contextTranslation,
      kind: "language",
      options: step.options.map((option) => ({
        feedback: option.feedback,
        isCorrect: option.isCorrect,
        text: option.text,
        textRomanization: emptyToNull(option.textRomanization),
      })),
    }),
    isPublished: true,
    kind: "multipleChoice" as const,
    position: index + 1,
  }));

  return [scenarioStep, ...storySteps];
}

async function handleLanguageStoryError(
  activityId: bigint | number,
  reason: WorkflowErrorReason,
): Promise<void> {
  await streamError({ reason, step: "generateLanguageStoryContent" });
  await handleActivityFailureStep({ activityId });
}

async function saveLanguageStorySteps(
  activityId: bigint | number,
  data: ActivityStoryLanguageSchema,
): Promise<{ error: Error | null }> {
  return safeAsync(() =>
    prisma.step.createMany({
      data: buildLanguageStorySteps(activityId, data),
    }),
  );
}

export async function generateLanguageStoryContentStep(
  activities: LessonActivity[],
  workflowRunId: string,
): Promise<{ generated: boolean }> {
  "use step";

  const activity = findActivityByKind(activities, "languageStory");

  if (!activity) {
    return { generated: false };
  }

  if (activity.generationStatus === "completed" || activity.generationStatus === "running") {
    return { generated: false };
  }

  if (activity.generationStatus === "failed") {
    await prisma.step.deleteMany({ where: { activityId: activity.id } });
  }

  await streamStatus({ status: "started", step: "generateLanguageStoryContent" });
  await setActivityAsRunningStep({ activityId: activity.id, workflowRunId });

  const { data: result, error }: SafeReturn<{ data: ActivityStoryLanguageSchema }> =
    await safeAsync(() =>
      generateActivityStoryLanguage({
        chapterTitle: activity.lesson.chapter.title,
        lessonDescription: activity.lesson.description ?? "",
        lessonTitle: activity.lesson.title,
        targetLanguage:
          activity.lesson.chapter.course.targetLanguage ?? activity.lesson.chapter.course.title,
        userLanguage: activity.language,
      }),
    );

  if (error || !result || !hasMinimumLanguageStoryContent(result.data)) {
    const reason = getAIResultErrorReason(error, result);
    await handleLanguageStoryError(activity.id, reason);
    return { generated: false };
  }

  const { error: saveError } = await saveLanguageStorySteps(activity.id, result.data);

  if (saveError) {
    await handleLanguageStoryError(activity.id, "dbSaveFailed");
    return { generated: false };
  }

  await streamStatus({ status: "completed", step: "generateLanguageStoryContent" });
  return { generated: true };
}

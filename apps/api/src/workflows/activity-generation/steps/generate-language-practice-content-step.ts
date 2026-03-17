import { type WorkflowErrorReason } from "@/workflows/_shared/stream-status";
import {
  type ActivityPracticeLanguageSchema,
  generateActivityPracticeLanguage,
} from "@zoonk/ai/tasks/activities/language/practice";
import { assertStepContent } from "@zoonk/core/steps/content-contract";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { logError, logInfo } from "@zoonk/utils/logger";
import { emptyToNull, normalizePunctuation } from "@zoonk/utils/string";
import { z } from "zod";
import { streamError, streamStatus } from "../stream-status";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

const minimumLanguagePracticeContentSchema = z.object({
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
              translation: z.string().trim().min(1),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

function hasMinimumLanguagePracticeContent(data: ActivityPracticeLanguageSchema): boolean {
  const result = minimumLanguagePracticeContentSchema.safeParse(data);

  if (!result.success) {
    logError(
      "[Language Practice] Content validation failed:",
      JSON.stringify(result.error.issues, null, 2),
    );
  }

  return result.success;
}

function buildLanguagePracticeSteps(
  activityId: bigint | number,
  data: ActivityPracticeLanguageSchema,
) {
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

  const practiceSteps = data.steps.map((step, index) => ({
    activityId,
    content: assertStepContent("multipleChoice", {
      context: normalizePunctuation(step.context),
      contextAudioUrl: null,
      contextRomanization: emptyToNull(step.contextRomanization),
      contextTranslation: normalizePunctuation(step.contextTranslation),
      kind: "language",
      options: step.options.map((option) => ({
        audioUrl: null,
        feedback: normalizePunctuation(option.feedback),
        isCorrect: option.isCorrect,
        text: normalizePunctuation(option.text),
        textRomanization: emptyToNull(option.textRomanization),
        translation: normalizePunctuation(option.translation),
      })),
    }),
    isPublished: true,
    kind: "multipleChoice" as const,
    position: index + 1,
  }));

  return [scenarioStep, ...practiceSteps];
}

async function handleLanguagePracticeError(
  activityId: bigint | number,
  reason: WorkflowErrorReason,
): Promise<void> {
  await streamError({ reason, step: "generateLanguagePracticeContent" });
  await handleActivityFailureStep({ activityId });
}

async function saveLanguagePracticeSteps(
  activityId: bigint | number,
  data: ActivityPracticeLanguageSchema,
): Promise<{ error: Error | null }> {
  return safeAsync(() =>
    prisma.step.createMany({
      data: buildLanguagePracticeSteps(activityId, data),
    }),
  );
}

export async function generateLanguagePracticeContentStep(
  activities: LessonActivity[],
  workflowRunId: string,
  concepts: string[] = [],
  neighboringConcepts: string[] = [],
): Promise<{ generated: boolean }> {
  "use step";

  const activity = findActivityByKind(activities, "languagePractice");

  if (!activity) {
    return { generated: false };
  }

  if (activity.generationStatus === "completed" || activity.generationStatus === "running") {
    return { generated: false };
  }

  if (activity.generationStatus === "failed") {
    await prisma.step.deleteMany({ where: { activityId: activity.id } });
  }

  await streamStatus({ status: "started", step: "generateLanguagePracticeContent" });
  await setActivityAsRunningStep({ activityId: activity.id, workflowRunId });

  const { data: result, error }: SafeReturn<{ data: ActivityPracticeLanguageSchema }> =
    await safeAsync(() =>
      generateActivityPracticeLanguage({
        chapterTitle: activity.lesson.chapter.title,
        concepts,
        lessonDescription: activity.lesson.description ?? "",
        lessonTitle: activity.lesson.title,
        neighboringConcepts,
        targetLanguage:
          activity.lesson.chapter.course.targetLanguage ?? activity.lesson.chapter.course.title,
        userLanguage: activity.language,
      }),
    );

  if (error) {
    logError("[Language Practice] AI generation error:", error.message);
    await handleLanguagePracticeError(activity.id, "aiGenerationFailed");
    return { generated: false };
  }

  if (!result) {
    logError("[Language Practice] AI returned empty result");
    await handleLanguagePracticeError(activity.id, "aiEmptyResult");
    return { generated: false };
  }

  if (!hasMinimumLanguagePracticeContent(result.data)) {
    logError(
      "[Language Practice] Content validation failed. Step count:",
      result.data.steps.length,
      "| First step options:",
      result.data.steps[0]?.options.length,
      "| Has translation:",
      result.data.steps[0]?.options[0] && "translation" in result.data.steps[0].options[0],
    );
    await handleLanguagePracticeError(activity.id, "contentValidationFailed");
    return { generated: false };
  }

  logInfo("[Language Practice] Content validated, saving steps for activity", activity.id);

  const { error: saveError } = await saveLanguagePracticeSteps(activity.id, result.data);

  if (saveError) {
    logError("[Language Practice] DB save error:", saveError.message);
    await handleLanguagePracticeError(activity.id, "dbSaveFailed");
    return { generated: false };
  }

  await streamStatus({ status: "completed", step: "generateLanguagePracticeContent" });
  return { generated: true };
}

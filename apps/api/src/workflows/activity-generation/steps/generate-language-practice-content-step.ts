import {
  type WorkflowErrorReason,
  getAIResultErrorReason,
} from "@/workflows/_shared/stream-status";
import {
  type ActivityPracticeLanguageSchema,
  generateActivityPracticeLanguage,
} from "@zoonk/ai/tasks/activities/language/practice";
import { assertStepContent } from "@zoonk/core/steps/content-contract";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
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
  return minimumLanguagePracticeContentSchema.safeParse(data).success;
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

  if (error || !result || !hasMinimumLanguagePracticeContent(result.data)) {
    const reason = getAIResultErrorReason(error, result);
    await handleLanguagePracticeError(activity.id, reason);
    return { generated: false };
  }

  const { error: saveError } = await saveLanguagePracticeSteps(activity.id, result.data);

  if (saveError) {
    await handleLanguagePracticeError(activity.id, "dbSaveFailed");
    return { generated: false };
  }

  await streamStatus({ status: "completed", step: "generateLanguagePracticeContent" });
  return { generated: true };
}

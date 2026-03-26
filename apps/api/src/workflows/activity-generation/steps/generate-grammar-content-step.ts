import {
  type WorkflowErrorReason,
  createStepStream,
  getAIResultErrorReason,
} from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";
import {
  type ActivityGrammarContentSchema,
  generateActivityGrammarContent,
} from "@zoonk/ai/tasks/activities/language/grammar-content";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { z } from "zod";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

const minimumGrammarContentSchema = z.object({
  examples: z.array(z.unknown()).min(1),
  exercises: z
    .array(
      z.object({
        answer: z.string().min(1),
      }),
    )
    .min(1),
});

function hasMinimumGrammarContent(data: ActivityGrammarContentSchema): boolean {
  return minimumGrammarContentSchema.safeParse(data).success;
}

/**
 * Generates the TARGET_LANGUAGE portion of grammar content (examples + exercises)
 * without saving to the database. Returns the raw AI output so downstream steps
 * can add user-language content and romanization before persisting.
 */
export async function generateGrammarContentStep(
  activities: LessonActivity[],
  workflowRunId: string,
  concepts: string[] = [],
  neighboringConcepts: string[] = [],
): Promise<{ generated: boolean; grammarContent: ActivityGrammarContentSchema | null }> {
  "use step";

  const activity = findActivityByKind(activities, "grammar");

  if (!activity) {
    return { generated: false, grammarContent: null };
  }

  if (activity.generationStatus === "completed" || activity.generationStatus === "running") {
    return { generated: false, grammarContent: null };
  }

  if (activity.generationStatus === "failed") {
    await prisma.step.deleteMany({ where: { activityId: activity.id } });
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "generateGrammarContent" });
  await setActivityAsRunningStep({ activityId: activity.id, workflowRunId });

  const { data: result, error }: SafeReturn<{ data: ActivityGrammarContentSchema }> =
    await safeAsync(() =>
      generateActivityGrammarContent({
        chapterTitle: activity.lesson.chapter.title,
        concepts,
        lessonDescription: activity.lesson.description ?? "",
        lessonTitle: activity.lesson.title,
        neighboringConcepts,
        targetLanguage:
          activity.lesson.chapter.course.targetLanguage ?? activity.lesson.chapter.course.title,
      }),
    );

  if (error || !result || !hasMinimumGrammarContent(result.data)) {
    const reason: WorkflowErrorReason = getAIResultErrorReason(error, result);
    await stream.error({ reason, step: "generateGrammarContent" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { generated: false, grammarContent: null };
  }

  await stream.status({ status: "completed", step: "generateGrammarContent" });
  return { generated: true, grammarContent: result.data };
}

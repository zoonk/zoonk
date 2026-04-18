import { createStepStream } from "@/workflows/_shared/stream-status";
import {
  type GeneratedCoreActivity,
  generateLessonCoreActivities,
} from "@zoonk/ai/tasks/lessons/core-activities";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { safeAsync } from "@zoonk/utils/error";
import { type LessonContext } from "./get-lesson-step";

/**
 * Core lessons need explanation activity titles before the fixed activity shell
 * can be created. This step keeps that planning call isolated from the rest of
 * the lesson workflow so the write step only deals with concrete activity rows.
 */
export async function generateCoreActivitiesStep(
  context: LessonContext,
): Promise<GeneratedCoreActivity[]> {
  "use step";

  await using stream = createStepStream<LessonStepName>();

  await stream.status({ status: "started", step: "generateCoreActivities" });

  const { data: result, error } = await safeAsync(() =>
    generateLessonCoreActivities({
      chapterTitle: context.chapter.title,
      concepts: context.concepts,
      courseTitle: context.chapter.course.title,
      language: context.language,
      lessonDescription: context.description,
      lessonTitle: context.title,
    }),
  );

  if (error) {
    await stream.error({ reason: "aiGenerationFailed", step: "generateCoreActivities" });
    throw error;
  }

  await stream.status({ status: "completed", step: "generateCoreActivities" });

  return result.data.activities;
}

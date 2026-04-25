import { createStepStream } from "@/workflows/_shared/stream-status";
import {
  type GeneratedCustomActivity,
  generateLessonCustomActivities,
} from "@zoonk/ai/tasks/lessons/custom-activities";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { safeAsync } from "@zoonk/utils/error";
import { type LessonContext } from "./get-lesson-step";

export async function generateCustomActivitiesStep(
  context: LessonContext,
): Promise<GeneratedCustomActivity[]> {
  "use step";

  await using stream = createStepStream<LessonStepName>();

  await stream.status({ status: "started", step: "generateCustomActivities" });

  const { data: result, error } = await safeAsync(() =>
    generateLessonCustomActivities({
      chapterTitle: context.chapter.title,
      courseTitle: context.chapter.course.title,
      language: context.language,
      lessonDescription: context.description,
      lessonTitle: context.title,
    }),
  );

  if (error) {
    throw error;
  }

  await stream.status({ status: "completed", step: "generateCustomActivities" });

  return result.data.activities;
}

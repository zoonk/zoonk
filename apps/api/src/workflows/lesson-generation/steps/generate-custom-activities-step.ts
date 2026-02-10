import { generateLessonActivities } from "@zoonk/ai/tasks/lessons/activities";
import { safeAsync } from "@zoonk/utils/error";
import { streamError, streamStatus } from "../stream-status";
import { type LessonContext } from "./get-lesson-step";

export type GeneratedActivity = {
  title: string;
  description: string;
};

export async function generateCustomActivitiesStep(
  context: LessonContext,
): Promise<GeneratedActivity[]> {
  "use step";

  await streamStatus({ status: "started", step: "generateCustomActivities" });

  const { data: result, error } = await safeAsync(() =>
    generateLessonActivities({
      chapterTitle: context.chapter.title,
      courseTitle: context.chapter.course.title,
      language: context.language,
      lessonDescription: context.description,
      lessonTitle: context.title,
    }),
  );

  if (error) {
    await streamError({ reason: "aiGenerationFailed", step: "generateCustomActivities" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "generateCustomActivities" });

  return result.data.activities;
}

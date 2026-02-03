import { generateLessonActivities } from "@zoonk/ai/tasks/lessons/activities";
import { streamStatus } from "../stream-status";
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

  try {
    const { data } = await generateLessonActivities({
      chapterTitle: context.chapter.title,
      courseTitle: context.chapter.course.title,
      language: context.language,
      lessonDescription: context.description,
      lessonTitle: context.title,
    });

    await streamStatus({ status: "completed", step: "generateCustomActivities" });

    return data.activities;
  } catch (error) {
    await streamStatus({ status: "error", step: "generateCustomActivities" });
    throw error;
  }
}

import {
  type ActivityBackgroundSchema,
  generateActivityBackground,
} from "@zoonk/ai/tasks/activities/core/background";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type ActivityContext } from "./get-activity-step";

export async function generateBackgroundStep(
  context: ActivityContext,
): Promise<ActivityBackgroundSchema> {
  "use step";

  await streamStatus({ status: "started", step: "generateBackground" });

  const { data: result, error } = await safeAsync(() =>
    generateActivityBackground({
      chapterTitle: context.lesson.chapter.title,
      courseTitle: context.lesson.chapter.course.title,
      language: context.language,
      lessonDescription: context.lesson.description ?? "",
      lessonTitle: context.lesson.title,
    }),
  );

  if (error) {
    await streamStatus({ status: "error", step: "generateBackground" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "generateBackground" });

  return result.data;
}

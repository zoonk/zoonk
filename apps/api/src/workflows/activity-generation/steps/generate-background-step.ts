import {
  type ActivityBackgroundSchema,
  generateActivityBackground,
} from "@zoonk/ai/tasks/activities/core/background";
import { streamStatus } from "../stream-status";
import { type ActivityContext } from "./get-activity-step";

export async function generateBackgroundStep(
  context: ActivityContext,
): Promise<ActivityBackgroundSchema> {
  "use step";

  await streamStatus({ status: "started", step: "generateBackground" });

  const { data } = await generateActivityBackground({
    chapterTitle: context.lesson.chapter.title,
    courseTitle: context.lesson.chapter.course.title,
    language: context.language,
    lessonDescription: context.lesson.description ?? "",
    lessonTitle: context.lesson.title,
  });

  await streamStatus({ status: "completed", step: "generateBackground" });

  return data;
}

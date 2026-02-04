import { type StepVisualSchema, generateStepVisuals } from "@zoonk/ai/tasks/steps/visual";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type ActivityContext } from "./get-activity-step";

export async function generateVisualsStep(
  context: ActivityContext,
  steps: { title: string; text: string }[],
): Promise<StepVisualSchema> {
  "use step";

  await streamStatus({ status: "started", step: "generateVisuals" });

  const { data: result, error } = await safeAsync(() =>
    generateStepVisuals({
      chapterTitle: context.lesson.chapter.title,
      courseTitle: context.lesson.chapter.course.title,
      language: context.language,
      lessonDescription: context.lesson.description ?? "",
      lessonTitle: context.lesson.title,
      steps,
    }),
  );

  if (error) {
    await streamStatus({ status: "error", step: "generateVisuals" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "generateVisuals" });

  return result.data;
}

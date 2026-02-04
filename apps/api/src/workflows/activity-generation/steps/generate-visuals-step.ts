import { type StepVisualSchema, generateStepVisuals } from "@zoonk/ai/tasks/steps/visual";
import { streamStatus } from "../stream-status";
import { type ActivityContext } from "./get-activity-step";

export async function generateVisualsStep(
  context: ActivityContext,
  steps: { title: string; text: string }[],
): Promise<StepVisualSchema> {
  "use step";

  await streamStatus({ status: "started", step: "generateVisuals" });

  const { data } = await generateStepVisuals({
    chapterTitle: context.lesson.chapter.title,
    courseTitle: context.lesson.chapter.course.title,
    language: context.language,
    lessonDescription: context.lesson.description ?? "",
    lessonTitle: context.lesson.title,
    steps,
  });

  await streamStatus({ status: "completed", step: "generateVisuals" });

  return data;
}

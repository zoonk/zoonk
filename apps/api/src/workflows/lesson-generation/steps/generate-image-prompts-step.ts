import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateStepImagePrompts } from "@zoonk/ai/tasks/steps/image-prompts";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type StaticLessonStep } from "./_utils/generated-lesson-content";
import { type LessonContext } from "./get-lesson-step";

/**
 * Generates one image prompt per readable static step so the later image step
 * can preserve the same order when it attaches generated images to content.
 */
export async function generateImagePromptsStep({
  context,
  steps,
}: {
  context: LessonContext;
  steps: StaticLessonStep[];
}): Promise<{ prompts: string[] }> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateImagePrompts" });

  if (steps.length === 0) {
    await stream.status({ status: "completed", step: "generateImagePrompts" });
    return { prompts: [] };
  }

  const result = await generateStepImagePrompts({
    chapterTitle: context.chapter.title,
    courseTitle: context.chapter.course.title,
    language: context.language,
    lessonDescription: context.description ?? "",
    lessonTitle: context.title ?? "",
    steps,
  });

  await stream.status({ status: "completed", step: "generateImagePrompts" });

  return { prompts: result.data.prompts };
}

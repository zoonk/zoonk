import { getCourseGenerationPolicy } from "@/workflows/_shared/course-generation-context";
import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateStepImagePrompts } from "@zoonk/ai/tasks/steps/image-prompts";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type StaticLessonStep } from "./_utils/generated-lesson-content";
import { type LessonContext } from "./get-lesson-step";

/**
 * Selects useful illustrations by explicit step index; empty slots preserve
 * alignment without requiring an image on every screen.
 */
export async function generateImagePromptsStep({
  context,
  steps,
}: {
  context: LessonContext;
  steps: StaticLessonStep[];
}): Promise<{ alts: string[]; prompts: string[] }> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateImagePrompts" });

  if (steps.length === 0) {
    await stream.status({ status: "completed", step: "generateImagePrompts" });
    return { alts: [], prompts: [] };
  }

  const result = await generateStepImagePrompts({
    chapterTitle: context.chapter.title,
    courseTitle: context.chapter.course.title,
    imageMode:
      context.chapter.course.userId || context.chapter.course.format === "personalized"
        ? "instructional"
        : "key",
    language: context.language,
    lessonDescription: context.description ?? "",
    lessonTitle: context.title ?? "",
    steps,
    ...getCourseGenerationPolicy(context.chapter.course),
  });

  await stream.status({ status: "completed", step: "generateImagePrompts" });

  return {
    alts: steps.map(
      (_, index) => result.data.images.find((image) => image.stepIndex === index)?.alt ?? "",
    ),
    prompts: steps.map(
      (_, index) => result.data.images.find((image) => image.stepIndex === index)?.prompt ?? "",
    ),
  };
}

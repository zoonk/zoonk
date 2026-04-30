import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateLessonExplanation } from "@zoonk/ai/tasks/lessons/core/explanation";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { getOtherExplanationLessonTitles } from "./_utils/explanation-source-steps";
import { type StaticLessonStep } from "./_utils/generated-lesson-content";
import { type LessonContext } from "./get-lesson-step";

/**
 * Generates the ordered explanation steps for one explanation lesson. Sibling
 * explanation titles are included so the model avoids repeating nearby lessons
 * in the same chapter.
 */
export async function generateExplanationContentStep(
  context: LessonContext,
): Promise<{ steps: StaticLessonStep[] }> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateExplanationContent" });

  const otherLessonTitles = await getOtherExplanationLessonTitles(context);
  const result = await generateLessonExplanation({
    chapterTitle: context.chapter.title,
    courseTitle: context.chapter.course.title,
    language: context.language,
    lessonDescription: context.description ?? "",
    lessonTitle: context.title ?? "",
    otherLessonTitles,
  });

  await stream.status({ status: "completed", step: "generateExplanationContent" });

  return {
    steps: [
      ...result.data.explanation.map((step) => ({ text: step.text, title: step.title })),
      { text: result.data.anchor.text, title: result.data.anchor.title },
    ],
  };
}

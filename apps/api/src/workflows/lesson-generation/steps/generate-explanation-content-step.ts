import { createStepStream, getAIResultErrorReason } from "@/workflows/_shared/stream-status";
import { generateLessonExplanation } from "@zoonk/ai/tasks/lessons/core/explanation";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { getOtherExplanationLessonTitles } from "./_utils/explanation-source-steps";
import { type StaticLessonStep } from "./_utils/generated-lesson-content";
import { type LessonContext } from "./get-lesson-step";

export async function generateExplanationContentStep(
  context: LessonContext,
): Promise<{ steps: StaticLessonStep[] }> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateExplanationContent" });

  const otherLessonTitles = await getOtherExplanationLessonTitles(context);
  const { data: result, error }: SafeReturn<Awaited<ReturnType<typeof generateLessonExplanation>>> =
    await safeAsync(() =>
      generateLessonExplanation({
        chapterTitle: context.chapter.title,
        courseTitle: context.chapter.course.title,
        language: context.language,
        lessonDescription: context.description,
        lessonTitle: context.title,
        otherLessonTitles,
      }),
    );

  if (error || !result || result.data.explanation.length === 0) {
    throw error ?? new Error(getAIResultErrorReason({ result }));
  }

  await stream.status({ status: "completed", step: "generateExplanationContent" });

  return {
    steps: [
      ...result.data.explanation.map((step) => ({ text: step.text, title: step.title })),
      { text: result.data.anchor.text, title: result.data.anchor.title },
    ],
  };
}

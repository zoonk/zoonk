import { createStepStream, getAIResultErrorReason } from "@/workflows/_shared/stream-status";
import { generateLessonCustom } from "@zoonk/ai/tasks/lessons/custom";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { type StaticLessonStep } from "./_utils/generated-lesson-content";
import { type LessonContext } from "./get-lesson-step";

export async function generateTutorialContentStep(
  context: LessonContext,
): Promise<{ steps: StaticLessonStep[] }> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateTutorialContent" });

  const { data: result, error }: SafeReturn<Awaited<ReturnType<typeof generateLessonCustom>>> =
    await safeAsync(() =>
      generateLessonCustom({
        chapterTitle: context.chapter.title,
        courseTitle: context.chapter.course.title,
        language: context.language,
        lessonDescription: context.description,
        lessonTitle: context.title,
      }),
    );

  if (error || !result || result.data.steps.length === 0) {
    throw error ?? new Error(getAIResultErrorReason({ result }));
  }

  await stream.status({ status: "completed", step: "generateTutorialContent" });

  return { steps: result.data.steps };
}

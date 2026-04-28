import { createStepStream, getAIResultErrorReason } from "@/workflows/_shared/stream-status";
import { generateLessonPractice } from "@zoonk/ai/tasks/lessons/core/practice";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { FatalError } from "workflow";
import { getExplanationStepsSinceLastLessonKind } from "./_utils/explanation-source-steps";
import { type PracticeLessonContent } from "./_utils/generated-lesson-content";
import { type LessonContext } from "./get-lesson-step";

export async function generatePracticeContentStep(
  context: LessonContext,
): Promise<PracticeLessonContent> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generatePracticeContent" });

  const explanationSteps = await getExplanationStepsSinceLastLessonKind({
    context,
    kind: "practice",
  });

  if (explanationSteps.length === 0) {
    throw new FatalError("Practice generation needs completed explanation lessons");
  }

  const { data: result, error }: SafeReturn<Awaited<ReturnType<typeof generateLessonPractice>>> =
    await safeAsync(() =>
      generateLessonPractice({
        chapterTitle: context.chapter.title,
        courseTitle: context.chapter.course.title,
        explanationSteps,
        language: context.language,
        lessonDescription: context.description,
        lessonTitle: context.title,
      }),
    );

  if (error || !result || result.data.steps.length === 0) {
    throw error ?? new Error(getAIResultErrorReason({ result }));
  }

  await stream.status({ status: "completed", step: "generatePracticeContent" });

  return {
    kind: "practice",
    scenario: result.data.scenario,
    steps: result.data.steps,
  };
}

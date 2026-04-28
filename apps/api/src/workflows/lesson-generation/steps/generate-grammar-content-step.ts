import { createStepStream, getAIResultErrorReason } from "@/workflows/_shared/stream-status";
import { generateLessonGrammarContent } from "@zoonk/ai/tasks/lessons/language/grammar-content";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { FatalError } from "workflow";
import { type LessonContext } from "./get-lesson-step";

export async function generateGrammarContentStep(
  context: LessonContext,
): Promise<Awaited<ReturnType<typeof generateLessonGrammarContent>>["data"]> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateGrammarContent" });

  const targetLanguage = context.chapter.course.targetLanguage;

  if (!targetLanguage) {
    throw new FatalError("Grammar generation needs a target language");
  }

  const {
    data: result,
    error,
  }: SafeReturn<Awaited<ReturnType<typeof generateLessonGrammarContent>>> = await safeAsync(() =>
    generateLessonGrammarContent({
      chapterTitle: context.chapter.title,
      lessonDescription: context.description,
      lessonTitle: context.title,
      targetLanguage,
    }),
  );

  if (error || !result || result.data.examples.length === 0) {
    throw error ?? new Error(getAIResultErrorReason({ result }));
  }

  await stream.status({ status: "completed", step: "generateGrammarContent" });

  return result.data;
}

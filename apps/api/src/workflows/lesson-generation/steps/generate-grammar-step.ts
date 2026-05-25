import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateLessonGrammar } from "@zoonk/ai/tasks/lessons/language/grammar";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { FatalError } from "workflow";
import { type LessonContext } from "./get-lesson-step";

export async function generateGrammarStep(
  context: LessonContext,
): Promise<Awaited<ReturnType<typeof generateLessonGrammar>>["data"]> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateGrammar" });

  const targetLanguage = context.chapter.course.targetLanguage;
  const userLanguage = context.chapter.course.language;

  if (!targetLanguage) {
    throw new FatalError("Grammar generation needs a target language");
  }

  const result = await generateLessonGrammar({
    chapterTitle: context.chapter.title,
    lessonDescription: context.description ?? "",
    lessonTitle: context.title ?? "",
    targetLanguage,
    userLanguage,
  });

  await stream.status({ status: "completed", step: "generateGrammar" });

  return result.data;
}

import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateLessonGrammarContent } from "@zoonk/ai/tasks/lessons/language/grammar-content";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
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

  const result = await generateLessonGrammarContent({
    chapterTitle: context.chapter.title,
    lessonDescription: context.description ?? "",
    lessonTitle: context.title ?? "",
    targetLanguage,
  });

  await stream.status({ status: "completed", step: "generateGrammarContent" });

  return result.data;
}

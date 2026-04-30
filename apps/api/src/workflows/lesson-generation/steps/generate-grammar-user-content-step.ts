import { createStepStream } from "@/workflows/_shared/stream-status";
import { type generateLessonGrammarContent } from "@zoonk/ai/tasks/lessons/language/grammar-content";
import { generateLessonGrammarUserContent } from "@zoonk/ai/tasks/lessons/language/grammar-user-content";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { FatalError } from "workflow";
import { type LessonContext } from "./get-lesson-step";

type GrammarContent = Awaited<ReturnType<typeof generateLessonGrammarContent>>["data"];

export async function generateGrammarUserContentStep({
  context,
  grammarContent,
}: {
  context: LessonContext;
  grammarContent: GrammarContent;
}): Promise<Awaited<ReturnType<typeof generateLessonGrammarUserContent>>["data"]> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateGrammarUserContent" });

  const targetLanguage = context.chapter.course.targetLanguage;

  if (!targetLanguage) {
    throw new FatalError("Grammar user content generation needs a target language");
  }

  const result = await generateLessonGrammarUserContent({
    chapterTitle: context.chapter.title,
    examples: grammarContent.examples,
    exercises: grammarContent.exercises,
    lessonDescription: context.description ?? "",
    lessonTitle: context.title ?? "",
    targetLanguage,
    userLanguage: context.language,
  });

  await stream.status({ status: "completed", step: "generateGrammarUserContent" });

  return result.data;
}

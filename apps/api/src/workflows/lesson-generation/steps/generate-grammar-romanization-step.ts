import { createStepStream } from "@/workflows/_shared/stream-status";
import { type generateLessonGrammarContent } from "@zoonk/ai/tasks/lessons/language/grammar-content";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { needsRomanization } from "@zoonk/utils/languages";
import { generateLessonRomanizations } from "./_utils/generate-lesson-romanizations";
import { type LessonContext } from "./get-lesson-step";

type GrammarContent = Awaited<ReturnType<typeof generateLessonGrammarContent>>["data"];

export async function generateGrammarRomanizationStep({
  context,
  grammarContent,
}: {
  context: LessonContext;
  grammarContent: GrammarContent;
}): Promise<{ romanizations: Record<string, string> | null }> {
  "use step";

  const targetLanguage = context.chapter.course.targetLanguage ?? "";

  if (!needsRomanization(targetLanguage)) {
    return { romanizations: null };
  }

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateGrammarRomanization" });

  const texts = [
    ...grammarContent.examples.map((example) => example.sentence),
    ...grammarContent.exercises.flatMap((exercise) => [
      exercise.template.replace("[BLANK]", exercise.answer),
      exercise.answer,
      ...exercise.distractors,
    ]),
  ];
  const romanizations = await generateLessonRomanizations({ targetLanguage, texts });

  await stream.status({ status: "completed", step: "generateGrammarRomanization" });

  return { romanizations };
}

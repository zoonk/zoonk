import { streamSkipStep } from "@/workflows/_shared/stream-skip-step";
import { createStepStream } from "@/workflows/_shared/stream-status";
import { type generateLessonGrammar } from "@zoonk/ai/tasks/lessons/language/grammar";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { needsRomanization } from "@zoonk/utils/languages";
import { generateLessonRomanizations } from "./_utils/generate-lesson-romanizations";
import { type RomanizationStepContext } from "./_utils/romanization-step-context";

type GrammarContent = Awaited<ReturnType<typeof generateLessonGrammar>>["data"];

export async function generateGrammarRomanizationStep({
  context,
  grammarContent,
}: {
  context: RomanizationStepContext;
  grammarContent: GrammarContent;
}): Promise<{ romanizations: Record<string, string> | null }> {
  "use step";

  const targetLanguage = context.chapter.course.targetLanguage ?? "";

  if (!needsRomanization(targetLanguage)) {
    await streamSkipStep("generateGrammarRomanization");
    return { romanizations: null };
  }

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateGrammarRomanization" });

  const texts = [
    ...grammarContent.examples.map((example) => example.sentence),
    ...grammarContent.questions.flatMap((question) => [
      question.template.replace("[BLANK]", question.answer),
      question.answer,
      ...question.distractors,
    ]),
  ];

  const romanizations = await generateLessonRomanizations({ targetLanguage, texts });

  await stream.status({ status: "completed", step: "generateGrammarRomanization" });

  return { romanizations };
}

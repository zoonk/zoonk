import { streamSkipStep } from "@/workflows/_shared/stream-skip-step";
import { createStepStream } from "@/workflows/_shared/stream-status";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { needsRomanization } from "@zoonk/utils/languages";
import { generateLessonRomanizations } from "./_utils/generate-lesson-romanizations";
import { type RomanizationStepContext } from "./_utils/romanization-step-context";

export async function generateVocabularyRomanizationStep({
  context,
  words,
}: {
  context: RomanizationStepContext;
  words: string[];
}): Promise<{ romanizations: Record<string, string> }> {
  "use step";

  const targetLanguage = context.chapter.course.targetLanguage ?? "";

  if (words.length === 0 || !needsRomanization(targetLanguage)) {
    await streamSkipStep("generateVocabularyRomanization");
    return { romanizations: {} };
  }

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateVocabularyRomanization" });

  const romanizations = await generateLessonRomanizations({ targetLanguage, texts: words });

  if (Object.keys(romanizations).length < words.length) {
    throw new Error("romanizationFailed");
  }

  await stream.status({ status: "completed", step: "generateVocabularyRomanization" });

  return { romanizations };
}

import { streamSkipStep } from "@/workflows/_shared/stream-skip-step";
import { createStepStream } from "@/workflows/_shared/stream-status";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { needsRomanization } from "@zoonk/utils/languages";
import { generateLessonRomanizations } from "./_utils/generate-lesson-romanizations";
import { type ReadingLessonContent } from "./_utils/generated-lesson-content";
import { type RomanizationStepContext } from "./_utils/romanization-step-context";

export async function generateReadingRomanizationStep({
  context,
  sentences,
}: {
  context: RomanizationStepContext;
  sentences: ReadingLessonContent["sentences"];
}): Promise<{ romanizations: Record<string, string> }> {
  "use step";

  const targetLanguage = context.chapter.course.targetLanguage ?? "";

  if (sentences.length === 0 || !needsRomanization(targetLanguage)) {
    await streamSkipStep("generateReadingRomanization");
    return { romanizations: {} };
  }

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateReadingRomanization" });

  const sentenceStrings = sentences.map((entry) => entry.sentence);

  const romanizations = await generateLessonRomanizations({
    targetLanguage,
    texts: sentenceStrings,
  });

  if (Object.keys(romanizations).length < sentences.length) {
    throw new Error("romanizationFailed");
  }

  await stream.status({ status: "completed", step: "generateReadingRomanization" });

  return { romanizations };
}

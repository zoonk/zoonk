import { createStepStream } from "@/workflows/_shared/stream-status";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { generateWordPronunciations } from "./_utils/generate-word-pronunciations";
import { type LessonContext } from "./get-lesson-step";

export async function generateSentenceWordPronunciationStep({
  context,
  words,
}: {
  context: LessonContext;
  words: string[];
}): Promise<{ pronunciations: Record<string, string> }> {
  "use step";

  if (words.length === 0 || !context.chapter.course.organization) {
    return { pronunciations: {} };
  }

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateSentenceWordPronunciation" });

  const pronunciations = await generateWordPronunciations({
    organizationId: context.chapter.course.organization.id,
    targetLanguage: context.chapter.course.targetLanguage ?? "",
    userLanguage: context.language,
    words,
  });

  await stream.status({ status: "completed", step: "generateSentenceWordPronunciation" });

  return { pronunciations };
}

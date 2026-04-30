import { createStepStream } from "@/workflows/_shared/stream-status";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { generateDirectDistractors } from "./_utils/generate-direct-distractors";
import { type ReadingLessonContent } from "./_utils/generated-lesson-content";
import { type LessonContext } from "./get-lesson-step";

export async function generateSentenceDistractorsStep({
  context,
  sentences,
}: {
  context: LessonContext;
  sentences: ReadingLessonContent["sentences"];
}): Promise<{
  distractors: Record<string, string[]>;
  translationDistractors: Record<string, string[]>;
}> {
  "use step";

  if (sentences.length === 0) {
    return { distractors: {}, translationDistractors: {} };
  }

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateSentenceDistractors" });

  const [distractors, translationDistractors] = await Promise.all([
    generateDirectDistractors({
      entries: sentences.map((sentence) => ({
        input: sentence.sentence,
        key: sentence.sentence,
      })),
      language: context.chapter.course.targetLanguage ?? "",
      shape: "single-word",
    }),
    generateDirectDistractors({
      entries: sentences.map((sentence) => ({
        input: sentence.translation,
        key: sentence.translation,
      })),
      language: context.language,
      shape: "single-word",
    }),
  ]);

  await stream.status({ status: "completed", step: "generateSentenceDistractors" });

  return { distractors, translationDistractors };
}

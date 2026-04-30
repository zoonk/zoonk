import { createStepStream } from "@/workflows/_shared/stream-status";
import { type VocabularyWord } from "@zoonk/ai/tasks/lessons/language/vocabulary";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { generateDirectDistractors } from "./_utils/generate-direct-distractors";
import { type LessonContext } from "./get-lesson-step";

export async function generateVocabularyDistractorsStep({
  context,
  words,
}: {
  context: LessonContext;
  words: VocabularyWord[];
}): Promise<{ distractors: Record<string, string[]> }> {
  "use step";

  if (words.length === 0) {
    return { distractors: {} };
  }

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateVocabularyDistractors" });

  const distractors = await generateDirectDistractors({
    entries: words.map((word) => ({
      input: word.word,
      key: word.word,
    })),
    language: context.chapter.course.targetLanguage ?? "",
    shape: "any",
  });

  await stream.status({ status: "completed", step: "generateVocabularyDistractors" });

  return { distractors };
}

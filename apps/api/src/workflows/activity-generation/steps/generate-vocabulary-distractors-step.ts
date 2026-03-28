import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { type VocabularyWord } from "@zoonk/ai/tasks/activities/language/vocabulary";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { generateDirectDistractors } from "./_utils/generate-direct-distractors";
import { type LessonActivity } from "./get-lesson-activities-step";

/**
 * Generates direct distractor words for each canonical vocabulary word.
 *
 * These distractors are stored directly on `LessonWord` and later resolved to `Word`
 * metadata for translation options. The step never derives distractors from semantic
 * filtering rules or other lessons.
 */
export async function generateVocabularyDistractorsStep(
  activities: LessonActivity[],
  words: VocabularyWord[],
): Promise<{ distractors: Record<string, string[]> }> {
  "use step";

  const activity = findActivityByKind(activities, "vocabulary");

  if (!activity || words.length === 0) {
    return { distractors: {} };
  }

  const targetLanguage = activity.lesson.chapter.course.targetLanguage ?? "";

  await using stream = createEntityStepStream<ActivityStepName>(activity.id);

  await stream.status({ status: "started", step: "generateVocabularyDistractors" });

  const distractors = await generateDirectDistractors({
    entries: words.map((word) => ({
      input: word.word,
      key: word.word,
    })),
    language: targetLanguage,
    shape: "any",
  });

  await stream.status({ status: "completed", step: "generateVocabularyDistractors" });
  return { distractors };
}

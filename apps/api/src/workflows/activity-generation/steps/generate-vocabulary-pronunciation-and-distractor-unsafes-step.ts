import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { type VocabularyWord } from "@zoonk/ai/tasks/activities/language/vocabulary";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { generateWordPronunciationAndDistractorUnsafes } from "./_utils/generate-word-pronunciation-and-distractor-unsafes";
import { type LessonActivity } from "./get-lesson-activities-step";

type PronunciationAndDistractorUnsafesResult = {
  distractorUnsafeTranslations: Record<string, string[]>;
  pronunciations: Record<string, string>;
};

/**
 * Generates pronunciation and distractorUnsafeTranslations for vocabulary words
 * that are missing them.
 *
 * Returns the generated data without writing to the database — the save step
 * persists the results.
 *
 * Thin wrapper around generateWordPronunciationAndDistractorUnsafes, scoped to
 * the vocabulary activity for stream status reporting.
 */
export async function generateVocabularyPronunciationAndDistractorUnsafesStep(
  activities: LessonActivity[],
  words: VocabularyWord[],
): Promise<PronunciationAndDistractorUnsafesResult> {
  "use step";

  const activity = findActivityByKind(activities, "vocabulary");

  if (!activity || words.length === 0) {
    return { distractorUnsafeTranslations: {}, pronunciations: {} };
  }

  const course = activity.lesson.chapter.course;

  if (!course.organization) {
    return { distractorUnsafeTranslations: {}, pronunciations: {} };
  }

  await using stream = createEntityStepStream<ActivityStepName>(activity.id);

  await stream.status({
    status: "started",
    step: "generateVocabularyPronunciationAndDistractorUnsafes",
  });

  const targetLanguage = course.targetLanguage ?? "";
  const userLanguage = activity.language;

  const result = await generateWordPronunciationAndDistractorUnsafes({
    lessonId: activity.lessonId,
    organizationId: course.organization.id,
    targetLanguage,
    userLanguage,
    words: words.map((entry) => ({ translation: entry.translation, word: entry.word })),
  });

  await stream.status({
    status: "completed",
    step: "generateVocabularyPronunciationAndDistractorUnsafes",
  });

  return result;
}

import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";
import { safeAsync } from "@zoonk/utils/error";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { generateWordPronunciationAndAlternatives } from "./_utils/generate-word-pronunciation-and-alternatives";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { type SavedWord } from "./save-vocabulary-words-step";

/**
 * Generates pronunciation and alternativeTranslations for vocabulary words
 * that are missing them. Alternative translations prevent semantically
 * equivalent words from appearing as distractors in exercises.
 *
 * Thin wrapper around the shared generateWordPronunciationAndAlternatives
 * utility, scoped to the vocabulary activity for stream status reporting.
 */
export async function generateVocabularyPronunciationAndAlternativesStep(
  activities: LessonActivity[],
  savedWords: SavedWord[],
): Promise<void> {
  "use step";

  const activity = findActivityByKind(activities, "vocabulary");

  if (!activity || savedWords.length === 0) {
    return;
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({
    status: "started",
    step: "generateVocabularyPronunciationAndAlternatives",
  });

  const course = activity.lesson.chapter.course;
  const targetLanguage = course.targetLanguage ?? "";
  const userLanguage = activity.language;

  const { error } = await safeAsync(() =>
    generateWordPronunciationAndAlternatives({ targetLanguage, userLanguage, words: savedWords }),
  );

  if (error) {
    await stream.error({
      reason: "enrichmentFailed",
      step: "generateVocabularyPronunciationAndAlternatives",
    });
    await handleActivityFailureStep({ activityId: activity.id });
    return;
  }

  await stream.status({
    status: "completed",
    step: "generateVocabularyPronunciationAndAlternatives",
  });
}

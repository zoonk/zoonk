import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";
import { safeAsync } from "@zoonk/utils/error";
import { enrichWordTranslations } from "./_utils/enrich-word-translations";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { type SavedWord } from "./save-vocabulary-words-step";

/**
 * Generates pronunciation and alternativeTranslations for vocabulary words
 * that are missing them. Thin wrapper around the shared enrichWordTranslations
 * utility, scoped to the vocabulary activity for stream status reporting.
 */
export async function enrichVocabularyWordTranslationsStep(
  activities: LessonActivity[],
  savedWords: SavedWord[],
): Promise<void> {
  "use step";

  const activity = findActivityByKind(activities, "vocabulary");

  if (!activity || savedWords.length === 0) {
    return;
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "enrichVocabularyWordTranslations" });

  const course = activity.lesson.chapter.course;
  const targetLanguage = course.targetLanguage ?? "";
  const userLanguage = activity.language;

  const { error } = await safeAsync(() =>
    enrichWordTranslations({ targetLanguage, userLanguage, words: savedWords }),
  );

  if (error) {
    await stream.error({
      reason: "enrichmentFailed",
      step: "enrichVocabularyWordTranslations",
    });
    await handleActivityFailureStep({ activityId: activity.id });
    return;
  }

  await stream.status({ status: "completed", step: "enrichVocabularyWordTranslations" });
}

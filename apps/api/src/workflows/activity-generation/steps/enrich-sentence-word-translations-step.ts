import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";
import { safeAsync } from "@zoonk/utils/error";
import { enrichWordTranslations } from "./_utils/enrich-word-translations";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { type SavedSentenceWord } from "./save-sentence-words-step";

/**
 * Generates pronunciation and alternativeTranslations for sentence-extracted
 * words that are missing them. Alternative translations prevent semantically
 * equivalent words from appearing as distractors in exercises.
 *
 * Thin wrapper around the shared enrichWordTranslations utility, scoped
 * to the reading activity for stream status reporting.
 */
export async function enrichSentenceWordTranslationsStep(
  activities: LessonActivity[],
  savedSentenceWords: SavedSentenceWord[],
): Promise<void> {
  "use step";

  const activity = findActivityByKind(activities, "reading");

  if (!activity || savedSentenceWords.length === 0) {
    return;
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "enrichSentenceWordTranslations" });

  const course = activity.lesson.chapter.course;
  const targetLanguage = course.targetLanguage ?? "";
  const userLanguage = activity.language;

  const { error } = await safeAsync(() =>
    enrichWordTranslations({ targetLanguage, userLanguage, words: savedSentenceWords }),
  );

  if (error) {
    await stream.error({
      reason: "enrichmentFailed",
      step: "enrichSentenceWordTranslations",
    });
    await handleActivityFailureStep({ activityId: activity.id });
    return;
  }

  await stream.status({
    status: "completed",
    step: "enrichSentenceWordTranslations",
  });
}

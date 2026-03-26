import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";
import { safeAsync } from "@zoonk/utils/error";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { generateWordPronunciationAndAlternatives } from "./_utils/generate-word-pronunciation-and-alternatives";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { type SavedSentenceWord } from "./save-sentence-words-step";

/**
 * Generates pronunciation and alternativeTranslations for sentence-extracted
 * words that are missing them. Alternative translations prevent semantically
 * equivalent words from appearing as distractors in exercises.
 *
 * Thin wrapper around generateWordPronunciationAndAlternatives, scoped to
 * the reading activity for stream status reporting.
 */
export async function generateSentencePronunciationAndAlternativesStep(
  activities: LessonActivity[],
  savedSentenceWords: SavedSentenceWord[],
): Promise<void> {
  "use step";

  const activity = findActivityByKind(activities, "reading");

  if (!activity || savedSentenceWords.length === 0) {
    return;
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({
    status: "started",
    step: "generateSentencePronunciationAndAlternatives",
  });

  const course = activity.lesson.chapter.course;
  const targetLanguage = course.targetLanguage ?? "";
  const userLanguage = activity.language;

  const { error } = await safeAsync(() =>
    generateWordPronunciationAndAlternatives({
      targetLanguage,
      userLanguage,
      words: savedSentenceWords,
    }),
  );

  if (error) {
    await stream.error({
      reason: "aiGenerationFailed",
      step: "generateSentencePronunciationAndAlternatives",
    });
    await handleActivityFailureStep({ activityId: activity.id });
    return;
  }

  await stream.status({
    status: "completed",
    step: "generateSentencePronunciationAndAlternatives",
  });
}

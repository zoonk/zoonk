import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { generateWordPronunciationAndAlternatives } from "./_utils/generate-word-pronunciation-and-alternatives";
import { type LessonActivity } from "./get-lesson-activities-step";

type PronunciationAndAlternativesResult = {
  alternatives: Record<string, string[]>;
  pronunciations: Record<string, string>;
};

/**
 * Generates pronunciation and alternativeTranslations for sentence-extracted
 * words that are missing them. Alternative translations prevent semantically
 * equivalent words from appearing as distractors in exercises.
 *
 * Returns the generated data without writing to the database — the save step
 * persists the results.
 *
 * Thin wrapper around generateWordPronunciationAndAlternatives, scoped to
 * the reading activity for stream status reporting.
 */
export async function generateSentencePronunciationAndAlternativesStep(
  activities: LessonActivity[],
  words: string[],
): Promise<PronunciationAndAlternativesResult> {
  "use step";

  const activity = findActivityByKind(activities, "reading");

  if (!activity || words.length === 0) {
    return { alternatives: {}, pronunciations: {} };
  }

  const course = activity.lesson.chapter.course;

  if (!course.organization) {
    return { alternatives: {}, pronunciations: {} };
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({
    status: "started",
    step: "generateSentencePronunciationAndAlternatives",
  });

  const targetLanguage = course.targetLanguage ?? "";
  const userLanguage = activity.language;

  const result = await generateWordPronunciationAndAlternatives({
    organizationId: course.organization.id,
    targetLanguage,
    userLanguage,
    words: words.map((entry) => ({ word: entry })),
  });

  await stream.status({
    status: "completed",
    step: "generateSentencePronunciationAndAlternatives",
  });

  return result;
}

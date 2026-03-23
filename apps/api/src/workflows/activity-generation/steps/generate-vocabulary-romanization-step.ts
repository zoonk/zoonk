import { generateActivityRomanization } from "@zoonk/ai/tasks/activities/language/romanization";
import { type VocabularyWord } from "@zoonk/ai/tasks/activities/language/vocabulary";
import { safeAsync } from "@zoonk/utils/error";
import { needsRomanization } from "@zoonk/utils/languages";
import { streamError, streamStatus } from "../stream-status";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * Generates romanized (Latin-script) representations of vocabulary words
 * for languages that use non-Roman writing systems (e.g., Japanese, Chinese, Korean).
 * This runs as a separate enrichment step so the AI vocabulary generation prompt
 * stays focused on word selection and translation quality.
 */
export async function generateVocabularyRomanizationStep(
  activities: LessonActivity[],
  words: VocabularyWord[],
): Promise<{ romanizations: Record<string, string> }> {
  "use step";

  const activity = findActivityByKind(activities, "vocabulary");

  if (!activity || words.length === 0) {
    return { romanizations: {} };
  }

  const course = activity.lesson.chapter.course;
  const targetLanguage = course.targetLanguage ?? "";

  if (!needsRomanization(targetLanguage)) {
    return { romanizations: {} };
  }

  await streamStatus({ status: "started", step: "generateVocabularyRomanization" });

  const wordStrings = words.map((vocabWord) => vocabWord.word);

  const { data: result, error } = await safeAsync(() =>
    generateActivityRomanization({ targetLanguage, texts: wordStrings }),
  );

  if (error || !result?.data) {
    await streamError({ reason: "enrichmentFailed", step: "generateVocabularyRomanization" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { romanizations: {} };
  }

  const romanizations: Record<string, string> = Object.fromEntries(
    wordStrings
      .map((word, index) => [word, result.data.romanizations[index]] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );

  if (Object.keys(romanizations).length < words.length) {
    await streamError({ reason: "enrichmentFailed", step: "generateVocabularyRomanization" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { romanizations };
  }

  await streamStatus({ status: "completed", step: "generateVocabularyRomanization" });
  return { romanizations };
}

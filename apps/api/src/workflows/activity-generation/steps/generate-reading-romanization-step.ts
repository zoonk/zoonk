import { generateActivityRomanization } from "@zoonk/ai/tasks/activities/language/romanization";
import { safeAsync } from "@zoonk/utils/error";
import { needsRomanization } from "@zoonk/utils/languages";
import { streamError, streamStatus } from "../stream-status";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { type SavedSentence } from "./save-reading-sentences-step";

/**
 * Generates romanized (Latin-script) representations of reading sentences
 * for languages that use non-Roman writing systems (e.g., Japanese, Chinese, Korean).
 * This runs as a separate enrichment step so the AI sentence generation prompt
 * stays focused on sentence quality, grammar, and translation accuracy.
 */
export async function generateReadingRomanizationStep(
  activities: LessonActivity[],
  savedSentences: SavedSentence[],
): Promise<{ romanizations: Record<string, string> }> {
  "use step";

  const activity = findActivityByKind(activities, "reading");

  if (!activity || savedSentences.length === 0) {
    return { romanizations: {} };
  }

  const course = activity.lesson.chapter.course;
  const targetLanguage = course.targetLanguage ?? "";

  if (!needsRomanization(targetLanguage)) {
    return { romanizations: {} };
  }

  await streamStatus({ status: "started", step: "generateReadingRomanization" });

  const sentenceStrings = savedSentences.map((saved) => saved.sentence);

  const { data: result, error } = await safeAsync(() =>
    generateActivityRomanization({ targetLanguage, texts: sentenceStrings }),
  );

  if (error || !result?.data) {
    await streamError({ reason: "enrichmentFailed", step: "generateReadingRomanization" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { romanizations: {} };
  }

  const romanizations: Record<string, string> = Object.fromEntries(
    sentenceStrings
      .map((sentence, index) => [sentence, result.data.romanizations[index]] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );

  if (Object.keys(romanizations).length < savedSentences.length) {
    await streamError({ reason: "enrichmentFailed", step: "generateReadingRomanization" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { romanizations };
  }

  await streamStatus({ status: "completed", step: "generateReadingRomanization" });
  return { romanizations };
}

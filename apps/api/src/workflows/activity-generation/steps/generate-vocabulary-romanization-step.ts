import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { generateActivityRomanization } from "@zoonk/ai/tasks/activities/language/romanization";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { safeAsync } from "@zoonk/utils/error";
import { needsRomanization } from "@zoonk/utils/languages";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * Generates romanized (Latin-script) representations of vocabulary words
 * for languages that use non-Roman writing systems (e.g., Japanese, Chinese, Korean).
 * This runs as a separate step so the AI vocabulary generation prompt
 * stays focused on word selection and translation quality.
 */
export async function generateVocabularyRomanizationStep(
  activities: LessonActivity[],
  words: string[],
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

  await using stream = createEntityStepStream<ActivityStepName>(activity.id);

  await stream.status({ status: "started", step: "generateVocabularyRomanization" });

  const wordStrings = words;

  const { data: result, error } = await safeAsync(() =>
    generateActivityRomanization({ targetLanguage, texts: wordStrings }),
  );

  if (error || !result?.data) {
    await stream.error({ reason: "romanizationFailed", step: "generateVocabularyRomanization" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { romanizations: {} };
  }

  const romanizations: Record<string, string> = Object.fromEntries(
    wordStrings
      .map((word, index) => [word, result.data.romanizations[index]] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );

  if (Object.keys(romanizations).length < words.length) {
    await stream.error({ reason: "romanizationFailed", step: "generateVocabularyRomanization" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { romanizations };
  }

  await stream.status({ status: "completed", step: "generateVocabularyRomanization" });
  return { romanizations };
}

import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { needsRomanization } from "@zoonk/utils/languages";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { generateActivityRomanizations } from "./_utils/generate-activity-romanizations";
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

  const targetLanguage = activity.lesson.chapter.course.targetLanguage ?? "";

  if (!needsRomanization(targetLanguage)) {
    return { romanizations: {} };
  }

  await using stream = createEntityStepStream<ActivityStepName>(activity.id);

  await stream.status({ status: "started", step: "generateVocabularyRomanization" });

  const romanizations = await generateActivityRomanizations({ targetLanguage, texts: words });

  if (!romanizations) {
    await stream.error({ reason: "romanizationFailed", step: "generateVocabularyRomanization" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { romanizations: {} };
  }

  if (Object.keys(romanizations).length < words.length) {
    await stream.error({ reason: "romanizationFailed", step: "generateVocabularyRomanization" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { romanizations };
  }

  await stream.status({ status: "completed", step: "generateVocabularyRomanization" });
  return { romanizations };
}

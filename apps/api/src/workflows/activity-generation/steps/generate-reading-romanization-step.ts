import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { needsRomanization } from "@zoonk/utils/languages";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { generateActivityRomanizations } from "./_utils/generate-activity-romanizations";
import { type ReadingSentence } from "./generate-reading-content-step";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * Generates romanized (Latin-script) representations of reading sentences
 * for languages that use non-Roman writing systems (e.g., Japanese, Chinese, Korean).
 * This runs as a separate step so the AI sentence generation prompt
 * stays focused on sentence quality, grammar, and translation accuracy.
 */
export async function generateReadingRomanizationStep(
  activities: LessonActivity[],
  sentences: ReadingSentence[],
): Promise<{ romanizations: Record<string, string> }> {
  "use step";

  const activity = findActivityByKind(activities, "reading");

  if (!activity || sentences.length === 0) {
    return { romanizations: {} };
  }

  const targetLanguage = activity.lesson.chapter.course.targetLanguage ?? "";

  if (!needsRomanization(targetLanguage)) {
    return { romanizations: {} };
  }

  const sentenceStrings = sentences.map((entry) => entry.sentence);

  await using stream = createEntityStepStream<ActivityStepName>(activity.id);

  await stream.status({ status: "started", step: "generateReadingRomanization" });

  const romanizations = await generateActivityRomanizations({
    targetLanguage,
    texts: sentenceStrings,
  });

  if (!romanizations) {
    await stream.error({ reason: "romanizationFailed", step: "generateReadingRomanization" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { romanizations: {} };
  }

  if (Object.keys(romanizations).length < sentences.length) {
    await stream.error({ reason: "romanizationFailed", step: "generateReadingRomanization" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { romanizations };
  }

  await stream.status({ status: "completed", step: "generateReadingRomanization" });
  return { romanizations };
}

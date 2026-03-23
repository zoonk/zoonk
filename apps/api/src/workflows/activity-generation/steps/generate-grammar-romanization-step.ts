import { type ActivityGrammarContentSchema } from "@zoonk/ai/tasks/activities/language/grammar-content";
import { generateActivityRomanization } from "@zoonk/ai/tasks/activities/language/romanization";
import { safeAsync } from "@zoonk/utils/error";
import { needsRomanization } from "@zoonk/utils/languages";
import { streamError, streamStatus } from "../stream-status";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * Generates romanized (Latin-script) versions of grammar example sentences
 * for languages that use non-Roman writing systems (e.g., Japanese, Chinese).
 * Skips the AI call entirely for Roman-script languages since romanization
 * would be redundant.
 */
export async function generateGrammarRomanizationStep(
  activities: LessonActivity[],
  grammarContent: ActivityGrammarContentSchema,
): Promise<{ romanizations: Record<string, string> | null }> {
  "use step";

  const activity = findActivityByKind(activities, "grammar");

  if (!activity) {
    return { romanizations: null };
  }

  const targetLanguage = activity.lesson.chapter.course.targetLanguage ?? "";

  if (!needsRomanization(targetLanguage)) {
    return { romanizations: null };
  }

  await streamStatus({ status: "started", step: "generateGrammarRomanization" });

  const sentences = grammarContent.examples.map((example) => example.sentence);

  const { data: result, error } = await safeAsync(() =>
    generateActivityRomanization({ targetLanguage, texts: sentences }),
  );

  if (error || !result?.data) {
    await streamError({ reason: "enrichmentFailed", step: "generateGrammarRomanization" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { romanizations: null };
  }

  const romanizations: Record<string, string> = Object.fromEntries(
    sentences.map((sentence, index) => [sentence, result.data.romanizations[index] ?? ""]),
  );

  await streamStatus({ status: "completed", step: "generateGrammarRomanization" });
  return { romanizations };
}

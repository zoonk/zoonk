import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";
import { type ActivityGrammarContentSchema } from "@zoonk/ai/tasks/activities/language/grammar-content";
import { generateActivityRomanization } from "@zoonk/ai/tasks/activities/language/romanization";
import { safeAsync } from "@zoonk/utils/error";
import { needsRomanization } from "@zoonk/utils/languages";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * Builds the full sentence by replacing [BLANK] with the correct answer.
 * We romanize the complete sentence so the player can show template-level
 * romanization with the answer portion swapped back to a blank at display time.
 */
function buildFullSentence(template: string, answer: string): string {
  return template.replace("[BLANK]", answer);
}

/**
 * Collects all unique texts that need romanization for grammar activities:
 * example sentences, full exercise sentences (template + answer merged),
 * and individual answer/distractor words for the word bank tiles.
 */
function collectTextsForRomanization(grammarContent: ActivityGrammarContentSchema): string[] {
  const exampleSentences = grammarContent.examples.map((example) => example.sentence);

  const exerciseTexts = grammarContent.exercises.flatMap((exercise) => {
    const fullSentence = buildFullSentence(exercise.template, exercise.answer);
    return [fullSentence, exercise.answer, ...exercise.distractors];
  });

  return [...new Set([...exampleSentences, ...exerciseTexts])];
}

/**
 * Generates romanized (Latin-script) versions of all grammar text content
 * for languages that use non-Roman writing systems (e.g., Japanese, Chinese).
 * This includes example sentences, exercise sentences (with answer filled in),
 * and individual answer/distractor words for the word bank.
 * Skips the AI call entirely for Roman-script languages.
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

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "generateGrammarRomanization" });

  const allTexts = collectTextsForRomanization(grammarContent);

  const { data: result, error } = await safeAsync(() =>
    generateActivityRomanization({ targetLanguage, texts: allTexts }),
  );

  if (error || !result?.data) {
    await stream.error({ reason: "romanizationFailed", step: "generateGrammarRomanization" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { romanizations: null };
  }

  const romanizations: Record<string, string> = Object.fromEntries(
    allTexts.map((text, index) => [text, result.data.romanizations[index] ?? ""]),
  );

  await stream.status({ status: "completed", step: "generateGrammarRomanization" });
  return { romanizations };
}

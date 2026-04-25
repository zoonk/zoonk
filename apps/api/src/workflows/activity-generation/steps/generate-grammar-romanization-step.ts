import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityGrammarContentSchema } from "@zoonk/ai/tasks/activities/language/grammar-content";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { needsRomanization } from "@zoonk/utils/languages";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { generateActivityRomanizations } from "./_utils/generate-activity-romanizations";
import { type LessonActivity } from "./get-lesson-activities-step";

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

  const allTexts = collectTextsForRomanization(grammarContent);

  await using stream = createEntityStepStream<ActivityStepName>(activity.id);

  await stream.status({ status: "started", step: "generateGrammarRomanization" });

  const romanizations = await generateActivityRomanizations({ targetLanguage, texts: allTexts });

  await stream.status({ status: "completed", step: "generateGrammarRomanization" });
  return { romanizations };
}

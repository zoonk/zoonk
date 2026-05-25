import { generateGrammarRomanizationStep } from "../steps/generate-grammar-romanization-step";
import { generateGrammarStep } from "../steps/generate-grammar-step";
import { type LessonContext } from "../steps/get-lesson-step";
import { saveGrammarLessonStep } from "../steps/save-grammar-lesson-step";

/**
 * Grammar content owns the learner explanation, examples, and questions in one
 * structure. Romanization runs afterward because it only enriches generated
 * target-language text for the player.
 */
export async function grammarLessonWorkflow(context: LessonContext): Promise<void> {
  "use workflow";

  const grammarContent = await generateGrammarStep(context);
  const { romanizations } = await generateGrammarRomanizationStep({ context, grammarContent });

  await saveGrammarLessonStep({ context, grammarContent, romanizations });
}

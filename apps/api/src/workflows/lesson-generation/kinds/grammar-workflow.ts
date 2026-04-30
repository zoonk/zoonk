import { generateGrammarContentStep } from "../steps/generate-grammar-content-step";
import { generateGrammarRomanizationStep } from "../steps/generate-grammar-romanization-step";
import { generateGrammarUserContentStep } from "../steps/generate-grammar-user-content-step";
import { type LessonContext } from "../steps/get-lesson-step";
import { saveGrammarLessonStep } from "../steps/save-grammar-lesson-step";

/**
 * The target-language grammar content is generated first. Learner-language
 * explanations and romanization then run in parallel because both depend on
 * that same generated grammar structure but not on each other.
 */
export async function grammarLessonWorkflow(context: LessonContext): Promise<void> {
  "use workflow";

  const grammarContent = await generateGrammarContentStep(context);

  const [userContent, { romanizations }] = await Promise.all([
    generateGrammarUserContentStep({ context, grammarContent }),
    generateGrammarRomanizationStep({ context, grammarContent }),
  ]);

  await saveGrammarLessonStep({
    context,
    grammarContent,
    romanizations,
    userContent,
  });
}

import { settled } from "@zoonk/utils/settled";
import { findActivityByKind } from "../steps/_utils/find-activity-by-kind";
import { generateGrammarContentStep } from "../steps/generate-grammar-content-step";
import { generateGrammarRomanizationStep } from "../steps/generate-grammar-romanization-step";
import { generateGrammarUserContentStep } from "../steps/generate-grammar-user-content-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { handleActivityFailureStep } from "../steps/handle-failure-step";
import { saveGrammarActivityStep } from "../steps/save-grammar-steps-step";

/**
 * Orchestrates grammar activity generation.
 *
 * Flow: generateContent -> [parallel: generateUserContent, generateRomanization] -> save.
 * The save step writes all steps and marks the activity as completed.
 *
 * Only generates if a grammar activity exists in the activitiesToGenerate list.
 */
export async function grammarActivityWorkflow({
  activitiesToGenerate,
  concepts,
  neighboringConcepts,
  workflowRunId,
}: {
  activitiesToGenerate: LessonActivity[];
  concepts: string[];
  neighboringConcepts: string[];
  workflowRunId: string;
}): Promise<void> {
  "use workflow";

  const grammarActivity = findActivityByKind(activitiesToGenerate, "grammar");

  if (!grammarActivity) {
    return;
  }

  const { generated, grammarContent } = await generateGrammarContentStep(
    grammarActivity,
    workflowRunId,
    concepts,
    neighboringConcepts,
  );

  if (!generated || !grammarContent) {
    return;
  }

  const [userContentResult, romanizationResult] = await Promise.allSettled([
    generateGrammarUserContentStep(activitiesToGenerate, grammarContent),
    generateGrammarRomanizationStep(activitiesToGenerate, grammarContent),
  ]);

  const { userContent } = settled(userContentResult, { userContent: null });
  const { romanizations } = settled(romanizationResult, { romanizations: null });

  if (!userContent) {
    await handleActivityFailureStep({ activityId: grammarActivity.id });
    return;
  }

  await saveGrammarActivityStep(
    activitiesToGenerate,
    workflowRunId,
    grammarContent,
    userContent,
    romanizations,
  );
}

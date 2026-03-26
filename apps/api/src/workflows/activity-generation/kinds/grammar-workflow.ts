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
 * Flow: generateContent → [parallel: generateUserContent, generateRomanization] → save.
 * The save step writes all steps and marks the activity as completed.
 */
export async function grammarActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
  concepts: string[],
  neighboringConcepts: string[],
): Promise<void> {
  "use workflow";

  const { generated, grammarContent } = await generateGrammarContentStep(
    activities,
    workflowRunId,
    concepts,
    neighboringConcepts,
  );

  if (!generated || !grammarContent) {
    return;
  }

  const [userContentResult, romanizationResult] = await Promise.allSettled([
    generateGrammarUserContentStep(activities, grammarContent),
    generateGrammarRomanizationStep(activities, grammarContent),
  ]);

  const { userContent } = settled(userContentResult, { userContent: null });
  const { romanizations } = settled(romanizationResult, { romanizations: null });

  if (!userContent) {
    const activity = findActivityByKind(activities, "grammar");

    if (activity) {
      await handleActivityFailureStep({ activityId: activity.id });
    }

    return;
  }

  await saveGrammarActivityStep(
    activities,
    workflowRunId,
    grammarContent,
    userContent,
    romanizations,
  );
}

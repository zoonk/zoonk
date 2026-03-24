import { settled } from "@zoonk/utils/settled";
import { findActivityByKind } from "../steps/_utils/find-activity-by-kind";
import { completeActivityStep } from "../steps/complete-activity-step";
import { generateGrammarContentStep } from "../steps/generate-grammar-content-step";
import { generateGrammarEnrichmentStep } from "../steps/generate-grammar-enrichment-step";
import { generateGrammarRomanizationStep } from "../steps/generate-grammar-romanization-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { handleActivityFailureStep } from "../steps/handle-failure-step";
import { saveGrammarStepsStep } from "../steps/save-grammar-steps-step";

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

  const [enrichmentResult, romanizationResult] = await Promise.allSettled([
    generateGrammarEnrichmentStep(activities, grammarContent),
    generateGrammarRomanizationStep(activities, grammarContent),
  ]);

  const { enrichment } = settled(enrichmentResult, { enrichment: null });
  const { romanizations } = settled(romanizationResult, { romanizations: null });

  if (!enrichment) {
    const activity = findActivityByKind(activities, "grammar");

    if (activity) {
      await handleActivityFailureStep({ activityId: activity.id });
    }

    return;
  }

  await saveGrammarStepsStep(activities, workflowRunId, grammarContent, enrichment, romanizations);
  await completeActivityStep(activities, workflowRunId, "grammar");
}

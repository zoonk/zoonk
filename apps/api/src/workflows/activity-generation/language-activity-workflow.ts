import { settled } from "@zoonk/utils/settled";
import { grammarActivityWorkflow } from "./kinds/grammar-workflow";
import { listeningActivityWorkflow } from "./kinds/listening-workflow";
import { readingActivityWorkflow } from "./kinds/reading-workflow";
import { vocabularyActivityWorkflow } from "./kinds/vocabulary-workflow";
import { type LessonActivity } from "./steps/get-lesson-activities-step";
import { getNeighboringConceptsStep } from "./steps/get-neighboring-concepts-step";

/**
 * Orchestrates language activity generation (vocabulary, grammar, reading, listening).
 * Receives both the full activity list and the subset that needs generation.
 * Generate steps only receive activities that need generation.
 * Completed activities are used to fetch existing data for downstream dependencies.
 */
export async function languageActivityWorkflow({
  activitiesToGenerate,
  allActivities,
  workflowRunId,
}: {
  activitiesToGenerate: LessonActivity[];
  allActivities: LessonActivity[];
  workflowRunId: string;
}): Promise<void> {
  const concepts = allActivities[0]?.lesson?.concepts ?? [];
  const neighboringConcepts = await getNeighboringConceptsStep(allActivities);

  const [vocabularyResult] = await Promise.allSettled([
    vocabularyActivityWorkflow({
      activitiesToGenerate,
      allActivities,
      concepts,
      neighboringConcepts,
      workflowRunId,
    }),
    grammarActivityWorkflow({
      activitiesToGenerate,
      concepts,
      neighboringConcepts,
      workflowRunId,
    }),
  ]);

  const { words } = settled(vocabularyResult, { words: [] });

  await readingActivityWorkflow({
    activitiesToGenerate,
    allActivities,
    concepts,
    neighboringConcepts,
    words,
    workflowRunId,
  });

  await listeningActivityWorkflow({ allActivities, workflowRunId });
}

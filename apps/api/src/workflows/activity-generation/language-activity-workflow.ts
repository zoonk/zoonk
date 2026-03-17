import { settled } from "@zoonk/utils/settled";
import { grammarActivityWorkflow } from "./kinds/grammar-workflow";
import { listeningActivityWorkflow } from "./kinds/listening-workflow";
import { readingActivityWorkflow } from "./kinds/reading-workflow";
import { vocabularyActivityWorkflow } from "./kinds/vocabulary-workflow";
import { type LessonActivity } from "./steps/get-lesson-activities-step";
import { getNeighboringConceptsStep } from "./steps/get-neighboring-concepts-step";

export async function languageActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
): Promise<void> {
  const concepts = activities[0]?.lesson?.concepts ?? [];
  const neighboringConcepts = await getNeighboringConceptsStep(activities);

  const [vocabularyResult] = await Promise.allSettled([
    vocabularyActivityWorkflow(activities, workflowRunId, concepts, neighboringConcepts),
    grammarActivityWorkflow(activities, workflowRunId, concepts, neighboringConcepts),
  ]);

  const { words } = settled(vocabularyResult, { words: [] });

  await readingActivityWorkflow(activities, workflowRunId, words, concepts, neighboringConcepts);
  await listeningActivityWorkflow(activities, workflowRunId);
}

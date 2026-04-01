import { settled } from "@zoonk/utils/settled";
import { explanationActivityWorkflow } from "./kinds/explanation-workflow";
import { practiceActivityWorkflow } from "./kinds/practice-workflow";
import { quizActivityWorkflow } from "./kinds/quiz-workflow";
import { storyActivityWorkflow } from "./kinds/story-workflow";
import { findActivitiesByKind } from "./steps/_utils/find-activity-by-kind";
import { type LessonActivity } from "./steps/get-lesson-activities-step";
import { getNeighboringConceptsStep } from "./steps/get-neighboring-concepts-step";

/**
 * Orchestrates core activity generation (explanation, practice, quiz, story).
 *
 * Wave 1 (parallel): explanation + story — story uses lesson concepts directly
 * and is independent of explanation results.
 * Wave 2 (parallel): practice + quiz — both depend on explanation results.
 *
 * Receives both the full activity list and the subset that needs generation.
 * Generate steps only receive activities that need generation.
 * Completed activities are used to fetch existing data for downstream dependencies.
 */
export async function coreActivityWorkflow({
  activitiesToGenerate,
  allActivities,
  workflowRunId,
}: {
  activitiesToGenerate: LessonActivity[];
  allActivities: LessonActivity[];
  workflowRunId: string;
}): Promise<void> {
  const concepts = allActivities[0]?.lesson?.concepts ?? [];
  const totalPractices = findActivitiesByKind(allActivities, "practice").length;
  const neighboringConcepts = await getNeighboringConceptsStep(allActivities);

  const [explanationResult] = await Promise.allSettled([
    explanationActivityWorkflow({
      activitiesToGenerate,
      allActivities,
      concepts,
      neighboringConcepts,
      workflowRunId,
    }),
    storyActivityWorkflow({
      activitiesToGenerate,
      workflowRunId,
    }),
  ]);

  const { results } = settled(explanationResult, { results: [] });

  await Promise.allSettled([
    practiceActivityWorkflow({
      activitiesToGenerate,
      allActivities,
      explanationResults: results,
      totalPractices,
      workflowRunId,
    }),
    quizActivityWorkflow({
      activitiesToGenerate,
      explanationResults: results,
      workflowRunId,
    }),
  ]);
}

import { explanationActivityWorkflow } from "./kinds/explanation-workflow";
import { practiceActivityWorkflow } from "./kinds/practice-workflow";
import { quizActivityWorkflow } from "./kinds/quiz-workflow";
import { findActivitiesByKind } from "./steps/_utils/find-activity-by-kind";
import { type LessonActivity } from "./steps/get-lesson-activities-step";

/**
 * Orchestrates core activity generation (explanation, practice, quiz).
 *
 * Wave 1: explanation activities produce the teaching flow.
 * Wave 2 (parallel): practice + quiz depend on those explanation results so
 * their generated content stays coherent with the taught flow.
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
  const lessonConcepts = allActivities[0]?.lesson?.concepts ?? [];
  const totalPractices = findActivitiesByKind(allActivities, "practice").length;

  const { results } = await explanationActivityWorkflow({
    activitiesToGenerate,
    allActivities,
    lessonConcepts,
    workflowRunId,
  });

  await Promise.allSettled([
    practiceActivityWorkflow({
      activitiesToGenerate,
      allActivities,
      explanationResults: results,
      totalPractices,
      workflowRunId,
    }),
    quizActivityWorkflow({ activitiesToGenerate, explanationResults: results, workflowRunId }),
  ]);
}

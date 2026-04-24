import { settled } from "@zoonk/utils/settled";
import { explanationActivityWorkflow } from "./kinds/explanation-workflow";
import { investigationActivityWorkflow } from "./kinds/investigation-workflow";
import { practiceActivityWorkflow } from "./kinds/practice-workflow";
import { quizActivityWorkflow } from "./kinds/quiz-workflow";
import { storyActivityWorkflow } from "./kinds/story-workflow";
import { findActivitiesByKind } from "./steps/_utils/find-activity-by-kind";
import { type LessonActivity } from "./steps/get-lesson-activities-step";

/**
 * Orchestrates core activity generation (explanation, practice, quiz, story, investigation).
 *
 * Wave 1 (parallel): explanation + investigation — investigation uses lesson
 * concepts directly and stays independent of explanation results.
 * Wave 2 (parallel): story + practice + quiz — these depend on explanation
 * results so their generated content stays coherent with the taught flow.
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

  const [explanationResult] = await Promise.allSettled([
    explanationActivityWorkflow({
      activitiesToGenerate,
      allActivities,
      lessonConcepts,
      workflowRunId,
    }),
    investigationActivityWorkflow({ activitiesToGenerate, workflowRunId }),
  ]);

  const { results } = settled(explanationResult, { results: [] });
  const explanationSteps = results.flatMap((result) => result.steps);

  await Promise.allSettled([
    storyActivityWorkflow({ activitiesToGenerate, explanationSteps, workflowRunId }),
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

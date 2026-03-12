import { settled } from "@zoonk/utils/settled";
import { challengeActivityWorkflow } from "./kinds/challenge-workflow";
import { explanationActivityWorkflow } from "./kinds/explanation-workflow";
import { practiceActivityWorkflow } from "./kinds/practice-workflow";
import { quizActivityWorkflow } from "./kinds/quiz-workflow";
import { findActivitiesByKind } from "./steps/_utils/find-activity-by-kind";
import { type LessonActivity } from "./steps/get-lesson-activities-step";
import { getNeighboringConceptsStep } from "./steps/get-neighboring-concepts-step";

export async function coreActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
): Promise<void> {
  const concepts = activities[0]?.lesson?.concepts ?? [];
  const totalPractices = findActivitiesByKind(activities, "practice").length;
  const neighboringConcepts = await getNeighboringConceptsStep(activities);

  const [explanationResult] = await Promise.allSettled([
    explanationActivityWorkflow(activities, workflowRunId, concepts, neighboringConcepts),
    challengeActivityWorkflow(activities, workflowRunId, concepts, neighboringConcepts),
  ]);

  const { results } = settled(explanationResult, { results: [] });

  await Promise.allSettled([
    practiceActivityWorkflow(activities, workflowRunId, results, totalPractices),
    quizActivityWorkflow(activities, workflowRunId, results),
  ]);
}

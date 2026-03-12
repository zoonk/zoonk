import { settled } from "@zoonk/utils/settled";
import { backgroundActivityWorkflow } from "./kinds/background-workflow";
import { challengeActivityWorkflow } from "./kinds/challenge-workflow";
import { examplesActivityWorkflow } from "./kinds/examples-workflow";
import { explanationActivityWorkflow } from "./kinds/explanation-workflow";
import { quizActivityWorkflow } from "./kinds/quiz-workflow";
import { storyActivityWorkflow } from "./kinds/story-workflow";
import { findActivitiesByKind } from "./steps/_utils/find-activity-by-kind";
import { type LessonActivity } from "./steps/get-lesson-activities-step";
import { getNeighboringConceptsStep } from "./steps/get-neighboring-concepts-step";

export async function coreActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
): Promise<void> {
  const concepts = activities[0]?.lesson?.concepts ?? [];
  const totalStories = findActivitiesByKind(activities, "story").length;
  const neighboringConcepts = await getNeighboringConceptsStep(activities);

  const [, explanationResult] = await Promise.allSettled([
    backgroundActivityWorkflow(activities, workflowRunId, concepts, neighboringConcepts),
    explanationActivityWorkflow(activities, workflowRunId, concepts, neighboringConcepts),
    examplesActivityWorkflow(activities, workflowRunId, concepts, neighboringConcepts),
    challengeActivityWorkflow(activities, workflowRunId, concepts, neighboringConcepts),
  ]);

  const { results } = settled(explanationResult, { results: [] });

  await Promise.allSettled([
    storyActivityWorkflow(activities, workflowRunId, results, totalStories),
    quizActivityWorkflow(activities, workflowRunId, results),
  ]);
}

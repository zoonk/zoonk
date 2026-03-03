import { type QuizQuestion } from "@zoonk/ai/tasks/activities/core/quiz";
import { settled } from "@zoonk/utils/settled";
import { findActivitiesByKind } from "./steps/_utils/find-activity-by-kind";
import { type ActivitySteps } from "./steps/_utils/get-activity-steps";
import { completeActivityStep } from "./steps/complete-activity-step";
import { generateBackgroundContentStep } from "./steps/generate-background-content-step";
import { generateChallengeContentStep } from "./steps/generate-challenge-content-step";
import { generateExamplesContentStep } from "./steps/generate-examples-content-step";
import {
  type ExplanationResult,
  generateExplanationContentStep,
} from "./steps/generate-explanation-content-step";
import { generateImagesForActivityStep, generateImagesStep } from "./steps/generate-images-step";
import { generateMechanicsContentStep } from "./steps/generate-mechanics-content-step";
import { generateQuizContentStep } from "./steps/generate-quiz-content-step";
import { generateQuizImagesStep } from "./steps/generate-quiz-images-step";
import { generateReviewContentStep } from "./steps/generate-review-content-step";
import { generateStoryContentStep } from "./steps/generate-story-content-step";
import {
  type StepVisual,
  generateVisualsForActivityStep,
  generateVisualsStep,
} from "./steps/generate-visuals-step";
import { type LessonActivity } from "./steps/get-lesson-activities-step";
import { getNeighboringConceptsStep } from "./steps/get-neighboring-concepts-step";

function getExplanationStepsForQuiz(
  explanationResults: ExplanationResult[],
  quizIndex: number,
  totalQuizzes: number,
): ActivitySteps {
  if (totalQuizzes <= 1) {
    return explanationResults.flatMap((result) => result.steps);
  }

  const splitIndex = Math.max(1, Math.floor(explanationResults.length / 2));
  const group =
    quizIndex === 0
      ? explanationResults.slice(0, splitIndex)
      : explanationResults.slice(splitIndex);

  return group.flatMap((result) => result.steps);
}

async function generateQuizzes(
  activities: LessonActivity[],
  explanationResults: ExplanationResult[],
  totalQuizzes: number,
  workflowRunId: string,
): Promise<{ quiz1: { questions: QuizQuestion[] }; quiz2: { questions: QuizQuestion[] } }> {
  const [quiz1Result, quiz2Result] = await Promise.allSettled([
    generateQuizContentStep(
      activities,
      getExplanationStepsForQuiz(explanationResults, 0, totalQuizzes),
      workflowRunId,
      0,
    ),
    totalQuizzes >= 2
      ? generateQuizContentStep(
          activities,
          getExplanationStepsForQuiz(explanationResults, 1, totalQuizzes),
          workflowRunId,
          1,
        )
      : Promise.resolve({ questions: [] }),
  ]);

  return {
    quiz1: settled(quiz1Result, { questions: [] }),
    quiz2: settled(quiz2Result, { questions: [] }),
  };
}

async function generateAllVisuals(
  activities: LessonActivity[],
  backgroundSteps: ActivitySteps,
  mechanicsSteps: ActivitySteps,
  examplesSteps: ActivitySteps,
  explanationResults: ExplanationResult[],
): Promise<{
  background: { visuals: StepVisual[] };
  explanation: { activityId: number; visuals: StepVisual[] }[];
  examples: { visuals: StepVisual[] };
  mechanics: { visuals: StepVisual[] };
}> {
  const explanationEntries = explanationResults.flatMap((result) => {
    const activity = activities.find((a) => a.id === result.activityId);
    if (!activity || result.steps.length === 0) {
      return [];
    }
    return [{ activity, result }];
  });

  const categoryVisualCount = 3;
  const allResults = await Promise.allSettled([
    generateVisualsStep(activities, backgroundSteps, "background"),
    generateVisualsStep(activities, mechanicsSteps, "mechanics"),
    generateVisualsStep(activities, examplesSteps, "examples"),
    ...explanationEntries.map((entry) =>
      generateVisualsForActivityStep(entry.activity, entry.result.steps),
    ),
  ]);

  const [backgroundResult, mechanicsResult, examplesResult] = allResults;
  const explanationVisualResults = allResults.slice(categoryVisualCount);

  const explanation = explanationEntries.map((entry, index) => {
    const result = explanationVisualResults[index];
    return {
      activityId: entry.result.activityId,
      visuals: result ? settled(result, { visuals: [] }).visuals : [],
    };
  });

  return {
    background: settled(backgroundResult, { visuals: [] }),
    examples: settled(examplesResult, { visuals: [] }),
    explanation,
    mechanics: settled(mechanicsResult, { visuals: [] }),
  };
}

export async function coreActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
): Promise<void> {
  const lesson = activities[0]?.lesson;
  const concepts = lesson?.concepts ?? [];
  const totalQuizzes = findActivitiesByKind(activities, "quiz").length;

  // Preamble: fetch neighboring concepts
  const neighboringConcepts = await getNeighboringConceptsStep(activities);

  // Wave 1: massive parallel — no interdependencies
  const [backgroundResult, explanationResult, mechanicsResult, examplesResult] =
    await Promise.allSettled([
      generateBackgroundContentStep(activities, concepts, neighboringConcepts, workflowRunId),
      generateExplanationContentStep(activities, concepts, neighboringConcepts, workflowRunId),
      generateMechanicsContentStep(activities, concepts, neighboringConcepts, workflowRunId),
      generateExamplesContentStep(activities, concepts, neighboringConcepts, workflowRunId),
      generateStoryContentStep(activities, concepts, neighboringConcepts, workflowRunId),
      generateChallengeContentStep(activities, concepts, neighboringConcepts, workflowRunId),
    ]);

  const backgroundContent = settled(backgroundResult, { steps: [] });
  const explanationContent = settled(explanationResult, { results: [] });
  const mechanicsContent = settled(mechanicsResult, { steps: [] });
  const examplesContent = settled(examplesResult, { steps: [] });
  const allExplanationSteps = explanationContent.results.flatMap((result) => result.steps);

  // Wave 2: quizzes + visuals + save story/challenge (parallel)
  const [quizzes, visuals] = await Promise.all([
    generateQuizzes(activities, explanationContent.results, totalQuizzes, workflowRunId),
    generateAllVisuals(
      activities,
      backgroundContent.steps,
      mechanicsContent.steps,
      examplesContent.steps,
      explanationContent.results,
    ),
    completeActivityStep(activities, workflowRunId, "story"),
    completeActivityStep(activities, workflowRunId, "challenge"),
  ]);

  // Wave 3: review + images + quiz images
  const explanationImagePromises = visuals.explanation.flatMap((explanationVisual) => {
    const activity = activities.find((a) => a.id === explanationVisual.activityId);
    if (!activity) {
      return [];
    }
    return [generateImagesForActivityStep(activity, explanationVisual.visuals)];
  });

  await Promise.allSettled([
    generateReviewContentStep(
      activities,
      backgroundContent.steps,
      allExplanationSteps,
      mechanicsContent.steps,
      examplesContent.steps,
      workflowRunId,
    ),
    generateImagesStep(activities, visuals.background.visuals, "background"),
    generateImagesStep(activities, visuals.mechanics.visuals, "mechanics"),
    generateImagesStep(activities, visuals.examples.visuals, "examples"),
    ...explanationImagePromises,
    generateQuizImagesStep(activities, quizzes.quiz1.questions, 0),
    ...(totalQuizzes >= 2 ? [generateQuizImagesStep(activities, quizzes.quiz2.questions, 1)] : []),
  ]);

  // Wave 4: save all remaining
  await Promise.allSettled([
    completeActivityStep(activities, workflowRunId, "background"),
    completeActivityStep(activities, workflowRunId, "explanation"),
    completeActivityStep(activities, workflowRunId, "quiz"),
    completeActivityStep(activities, workflowRunId, "review"),
    completeActivityStep(activities, workflowRunId, "mechanics"),
    completeActivityStep(activities, workflowRunId, "examples"),
  ]);
}

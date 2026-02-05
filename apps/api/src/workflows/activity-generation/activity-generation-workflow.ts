import { getLessonActivitiesStep } from "./steps/get-lesson-activities-step";
import { backgroundWorkflow } from "./workflows/background-workflow";
import { explanationWorkflow } from "./workflows/explanation-workflow";
import { mechanicsWorkflow } from "./workflows/mechanics-workflow";
import { quizWorkflow } from "./workflows/quiz-workflow";

/**
 * Activity generation workflow.
 *
 * Starts all activity workflows in parallel. Each workflow handles its own
 * dependency waiting via hooks. Workflows that need to wait for dependencies
 * suspend (no resource usage) until the dependency notifies them.
 *
 * Dependency graph:
 * background (no deps) → explanation → mechanics
 *                                   → quiz
 *
 * Using Promise.allSettled so one activity failing doesn't prevent others
 * from completing (isolation).
 */
export async function activityGenerationWorkflow(lessonId: number): Promise<void> {
  "use workflow";

  const activities = await getLessonActivitiesStep(lessonId);

  // Start ALL workflows in parallel via direct await (workflow composition)
  // Each workflow handles its own dependency waiting via hooks
  await Promise.allSettled([
    backgroundWorkflow(activities, lessonId),
    explanationWorkflow(activities, lessonId),
    mechanicsWorkflow(activities, lessonId),
    quizWorkflow(activities, lessonId),
  ]);
}

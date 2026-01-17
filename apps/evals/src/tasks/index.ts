import type { Task } from "@/lib/types";
import { activityBackgroundTask } from "./activity-background/task";
import { activityChallengeTask } from "./activity-challenge/task";
import { activityExamplesTask } from "./activity-examples/task";
import { activityExplanationTask } from "./activity-explanation/task";
import { activityExplanationQuizTask } from "./activity-explanation-quiz/task";
import { activityMechanicsTask } from "./activity-mechanics/task";
import { activityReviewTask } from "./activity-review/task";
import { activityStoryTask } from "./activity-story/task";
import { alternativeTitlesTask } from "./alternative-titles/task";
import { chapterLessonsTask } from "./chapter-lessons/task";
import { courseCategoriesTask } from "./course-categories/task";
import { courseChaptersTask } from "./course-chapters/task";
import { courseDescriptionTask } from "./course-description/task";
import { courseSuggestionsTask } from "./course-suggestions/task";
import { lessonActivitiesTask } from "./lesson-activities/task";
import { lessonKindTask } from "./lesson-kind/task";
import { stepVisualTask } from "./step-visual/task";

export const TASKS: readonly Task[] = [
  courseCategoriesTask,
  courseSuggestionsTask,
  alternativeTitlesTask,
  courseChaptersTask,
  courseDescriptionTask,
  chapterLessonsTask,
  lessonKindTask,
  lessonActivitiesTask,
  activityBackgroundTask,
  activityExplanationTask,
  activityExplanationQuizTask,
  activityMechanicsTask,
  activityExamplesTask,
  activityStoryTask,
  activityChallengeTask,
  activityReviewTask,
  stepVisualTask,
];

// Number of times each test case should be run for more reliable results
export const RUNS_PER_TEST_CASE = 1;

export function getTaskById(taskId: string): Task | undefined {
  return TASKS.find((t) => t.id === taskId);
}

export function getTotalTestCases(taskId: string): number {
  const task = getTaskById(taskId);
  const totalTestCases = task?.testCases.length ?? 0;
  return totalTestCases * RUNS_PER_TEST_CASE;
}

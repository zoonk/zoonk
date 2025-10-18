import type { Task } from "@/lib/types";
import { alternativeTitlesTask } from "./alternative-titles/task";
import { courseSuggestionsTask } from "./course-suggestions/task";

export const TASKS: readonly Task[] = [
  courseSuggestionsTask,
  alternativeTitlesTask,
];

// Number of times each test case should be run for more reliable results
export const RUNS_PER_TEST_CASE = 3;

export function getTaskById(taskId: string): Task | undefined {
  return TASKS.find((t) => t.id === taskId);
}

export function getTotalTestCases(taskId: string): number {
  const task = getTaskById(taskId);
  const totalTestCases = task?.testCases.length ?? 0;
  return totalTestCases * RUNS_PER_TEST_CASE;
}

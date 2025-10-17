import { courseSuggestionsTask } from "./course-suggestions/task";

export const TASKS = [courseSuggestionsTask];

export function getTaskById(taskId: string) {
  return TASKS.find((t) => t.id === taskId);
}

export function getTotalTestCases(taskId: string): number {
  const task = getTaskById(taskId);
  return task?.testCases.length ?? 0;
}

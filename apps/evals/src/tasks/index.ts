import type { Task } from "@/lib/types";
import { alternativeTitlesTask } from "./alternative-titles/task";
import { courseSuggestionsTask } from "./course-suggestions/task";

export const TASKS: readonly Task[] = [
  courseSuggestionsTask,
  alternativeTitlesTask,
];

export function getTaskById(taskId: string): Task | undefined {
  return TASKS.find((t) => t.id === taskId);
}

export function getTotalTestCases(taskId: string): number {
  const task = getTaskById(taskId);
  return task?.testCases.length ?? 0;
}

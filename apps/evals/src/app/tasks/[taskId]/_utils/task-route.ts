import { getTaskById } from "@/tasks";
import { notFound } from "next/navigation";
import { cache } from "react";

export type TaskRouteParams = Promise<{ taskId: string }>;

/**
 * Resolves and validates the shared task route parameter once so sibling
 * Suspense regions can render independently without repeating route lookup
 * work or drifting on invalid-task behavior.
 */
export const getTaskRoute = cache(async (params: TaskRouteParams) => {
  const { taskId } = await params;
  const task = getTaskById(taskId);

  if (!task) {
    notFound();
  }

  return { task, taskId };
});

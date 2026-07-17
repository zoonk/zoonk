import { getTaskById } from "@/tasks";
import { notFound } from "next/navigation";
import { cache } from "react";

export type TaskRouteParams = Promise<{ taskId: string }>;

/**
 * Resolves and validates the shared task route value once so sibling
 * Suspense regions can render independently without repeating route lookup
 * work or drifting on invalid-task behavior.
 */
export const getTaskRoute = cache(async (taskId: string) => {
  const task = getTaskById(taskId);

  if (!task) {
    notFound();
  }

  return { task, taskId };
});

/**
 * Next exposes route params as a Promise, while React cache needs the resolved
 * primitive value to deduplicate lookups across independently streamed regions.
 */
export async function getTaskRouteFromParams(params: TaskRouteParams) {
  const { taskId } = await params;

  return getTaskRoute(taskId);
}

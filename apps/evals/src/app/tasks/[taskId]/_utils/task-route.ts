import { getTaskById } from "@/tasks";
import { notFound } from "next/navigation";
import { cache } from "react";

export type TaskRouteParams = Promise<{ taskId: string }>;

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

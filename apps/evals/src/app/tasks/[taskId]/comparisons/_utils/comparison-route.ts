import { decide } from "@/lib/comparisons/decision";
import { listComparisons, loadComparison } from "@/lib/comparisons/storage";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getTaskRoute } from "../../_utils/task-route";

export const getComparisonRoute = cache(async (taskId: string, id: string) => {
  const [{ task }, ids] = await Promise.all([getTaskRoute(taskId), listComparisons(taskId)]);

  if (!ids.includes(id)) {
    notFound();
  }

  const comparison = await loadComparison(taskId, id);

  return { comparison, decision: decide(comparison), id, task, taskId };
});

export type ComparisonRoute = Awaited<ReturnType<typeof getComparisonRoute>>;

/** All of a task's comparisons with their current outcome, newest first. */
export const getTaskComparisons = cache(async (taskId: string) => {
  const ids = await listComparisons(taskId);
  const routes = await Promise.all(ids.map((id) => getComparisonRoute(taskId, id)));

  return routes.toSorted((left, right) =>
    right.comparison.manifest.date.localeCompare(left.comparison.manifest.date),
  );
});

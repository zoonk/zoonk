import "server-only";
import { getRequestInstant } from "../learner/facts/request-instant";
import { resolveViewGoal } from "../view-models/_utils/resolve-view-goal";
import { loadMindMapChapters } from "./_utils/load-mind-map-chapters";
import { getMindMapStatus } from "./_utils/mind-map-view";

/** Whether `listGoalMindMaps` lists any chapter for the goal (the active one by default), without building the list. */
export async function hasGoalMindMaps(input: { goalId?: string } = {}): Promise<boolean> {
  "use cache: private";

  const resolved = await resolveViewGoal(input.goalId);

  if (resolved.status !== "ready") {
    return false;
  }

  const [chapters, now] = await Promise.all([
    loadMindMapChapters({ goal: resolved.goal }),
    getRequestInstant(),
  ]);

  return chapters.some((chapter) => getMindMapStatus({ ...chapter, now }) !== "unavailable");
}

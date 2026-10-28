import "server-only";
import { isPlanReady } from "./_utils/apply-plan-change";
import { hasOverduePlanWork } from "./_utils/left-work";
import { loadOwnedPlanContext } from "./_utils/owned-plan";

export type GoalResumePreviewResult =
  | { preview: boolean; status: "ready" }
  | { status: "notFound" | "unauthorized" };

/** The saved plan stays visible; the resume POST plans from that day's current inputs. */
export async function getGoalResumePreview(goalId: string): Promise<GoalResumePreviewResult> {
  "use cache: private";
  const loaded = await loadOwnedPlanContext(goalId);

  if (loaded.status !== "ready") {
    return loaded;
  }

  const { context } = loaded;

  return {
    preview:
      isPlanReady(context) && context.goal.status === "paused" && hasOverduePlanWork(context),
    status: "ready",
  };
}

import "server-only";
import { isPlanReady } from "./_utils/apply-plan-change";
import { foldChangeAreas } from "./_utils/fold-part-areas";
import { loadOwnedPlanContext } from "./_utils/owned-plan";
import { loadGraphPartAreas } from "./_utils/part-areas";
import { computeResumedPlan } from "./_utils/resumed-plan";
import { type PlanChangePreview } from "./plan-preview-contract";

export type GoalResumePreviewResult =
  | { preview: PlanChangePreview; status: "ready" }
  | { status: "notFound" | "unauthorized" };

const UNCHANGED: PlanChangePreview = {
  effect: null,
  feasibility: null,
  ready: true,
  unchanged: true,
};

const BUILDING: PlanChangePreview = {
  effect: null,
  feasibility: null,
  ready: false,
  unchanged: false,
};

/**
 * What resuming one of the learner's paused goals would do to its plan, shown where they resume it,
 * with nothing saved: planned as resuming plans it (see `computeResumedPlan`). Unchanged when the
 * plan stays as it is, as after a pause that left nothing behind, or for a goal that isn't paused.
 */
export async function getGoalResumePreview(goalId: string): Promise<GoalResumePreviewResult> {
  "use cache: private";

  const loaded = await loadOwnedPlanContext(goalId);

  if (loaded.status !== "ready") {
    return loaded;
  }

  const { context } = loaded;

  if (context.goal.status !== "paused") {
    return { preview: UNCHANGED, status: "ready" };
  }

  if (!isPlanReady(context)) {
    return { preview: BUILDING, status: "ready" };
  }

  const [resumed, partAreas] = await Promise.all([
    computeResumedPlan(context, { reuseReadBuild: true }),
    loadGraphPartAreas({
      examBlueprintId: context.goal.examBlueprintId,
      graph: context.state.graph,
    }),
  ]);

  if (!resumed) {
    return { preview: UNCHANGED, status: "ready" };
  }

  const { coreFits, coveredShare, fits, measure } = resumed.computed.feasibility;

  return {
    preview: {
      effect: foldChangeAreas({ change: { effect: resumed.effect, operations: [] }, partAreas })
        .effect,
      feasibility: { coreFits, coveredShare: Math.round(coveredShare * 100) / 100, fits, measure },
      ready: true,
      unchanged: false,
    },
    status: "ready",
  };
}

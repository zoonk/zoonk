import "server-only";
import { isPlanReady } from "./_utils/apply-plan-change";
import { computeChange } from "./_utils/compute-change";
import { foldChangeAreas } from "./_utils/fold-part-areas";
import { findOwnedPlan } from "./_utils/owned-plan";
import { applyChangeOperations, loadGraphPartAreas } from "./_utils/part-areas";
import { type PlanChangeInput } from "./plan-contract";
import { type PlanChangePreview } from "./plan-preview-contract";
import { type PlanOperationError } from "./planner/plan-operations";

export type PlanChangePreviewResult =
  | { preview: PlanChangePreview; status: "ready" }
  | { error: PlanOperationError; status: "invalid" }
  | { status: "notFound" | "unauthorized" };

const BUILDING: PlanChangePreview = {
  effect: null,
  feasibility: null,
  ready: false,
  unchanged: false,
};

/**
 * What a change the learner is weighing would do to their plan, before they make it: planned from
 * today as applying it plans it (see `computeChange`), with nothing saved. The bases' choices,
 * studying everything and any other change read their effect here, so the learner sees what moves
 * before they confirm.
 */
export async function previewPlanChange({
  goalId,
  input,
}: {
  goalId: string;
  input: PlanChangeInput;
}): Promise<PlanChangePreviewResult> {
  const owned = await findOwnedPlan({ goalId, timeZone: input.timeZone });

  if (owned.status !== "ready") {
    return owned;
  }

  const { context } = owned;

  const [result, partAreas] = await Promise.all([
    applyChangeOperations({ context, operations: input.operations }),
    loadGraphPartAreas({
      examBlueprintId: context.goal.examBlueprintId,
      graph: context.state.graph,
    }),
  ]);

  if ("error" in result) {
    return { error: result.error, status: "invalid" };
  }

  if (!isPlanReady(context)) {
    return { preview: BUILDING, status: "ready" };
  }

  const { computed, effect, unchanged } = await computeChange({
    context,
    operations: result.operations,
    state: result.state,
  });

  const { coreFits, coveredShare, fits, measure } = computed.feasibility;

  return {
    preview: {
      effect: foldChangeAreas({ change: { effect, operations: [] }, partAreas }).effect,
      feasibility: { coreFits, coveredShare: Math.round(coveredShare * 100) / 100, fits, measure },
      ready: true,
      unchanged,
    },
    status: "ready",
  };
}

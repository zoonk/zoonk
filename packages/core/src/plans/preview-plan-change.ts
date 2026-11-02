import "server-only";
import { isPlanReady } from "./_utils/apply-plan-change";
import { computeChange } from "./_utils/compute-change";
import { foldChangeAreas } from "./_utils/fold-part-areas";
import { findOwnedPlan } from "./_utils/owned-plan";
import { applyChangeOperations, loadGraphPartAreas } from "./_utils/part-areas";
import { assertPlanTargetDates } from "./_utils/plan-target-dates";
import { withPlanRetry } from "./plan-conflict";
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

/** Saves nothing: it plans from today as applying the change would. */
export async function previewPlanChange({
  goalId,
  input,
}: {
  goalId: string;
  input: PlanChangeInput;
}): Promise<PlanChangePreviewResult> {
  return withPlanRetry(async () => {
    const owned = await findOwnedPlan({ goalId, timeZone: input.timeZone });

    if (owned.status !== "ready") {
      return owned;
    }

    const { context } = owned;
    assertPlanTargetDates({ context, operations: input.operations });

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
        feasibility: {
          coreFits,
          coveredShare: Math.round(coveredShare * 100) / 100,
          fits,
          measure,
        },
        ready: true,
        unchanged,
      },
      status: "ready",
    };
  });
}

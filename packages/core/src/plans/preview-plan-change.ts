import "server-only";
import { isPlanReady } from "./_utils/apply-plan-change";
import { computeChange } from "./_utils/compute-change";
import { foldChangeAreas } from "./_utils/fold-part-areas";
import { findOwnedPlan } from "./_utils/owned-plan";
import { applyChangeOperations, loadGraphPartAreas } from "./_utils/part-areas";
import { writePlanMetadata } from "./_utils/plan-metadata-write";
import { assertPlanTargetDates } from "./_utils/plan-target-dates";
import { prepareProposalPreviews } from "./_utils/prepare-plan-write";
import { revalidatePlanTags } from "./_utils/replan";
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

    const { baseline, computed, effect, unchanged } = await computeChange({
      context,
      operations: result.operations,
      state: result.state,
    });

    const previews = await prepareProposalPreviews({ baseline, context });

    if (previews.length > 0) {
      await writePlanMetadata({
        context,
        write: (tx) =>
          Promise.all(
            previews.map((preview) =>
              tx.planChange.updateMany({
                data: { payload: preview.payload },
                where: { id: preview.id, status: "proposed" },
              }),
            ),
          ),
      });

      revalidatePlanTags(context.goal.userId);
    }

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

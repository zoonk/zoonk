import "server-only";
import { interpretPlanEdit } from "@zoonk/ai/tasks/v2/plans/edit-intent";
import { claimAssist } from "../entitlements/claim-usage";
import { type RefusedUsage } from "../entitlements/contract";
import { toProvenanceData } from "../library/_utils/library-rows";
import { proposeChange } from "./_utils/apply-plan-change";
import { findOwnedPlan, loadPlanChangeView } from "./_utils/owned-plan";
import { type PlanContext, loadPlanContext } from "./_utils/plan-context";
import { toPlanEditInput } from "./_utils/plan-edit-input";
import { loadPlanMemory } from "./_utils/plan-memory";
import { withPlanRetry } from "./_utils/replan";
import { type PlanEditRequestInput } from "./plan-contract";
import { type PlanChangeView } from "./plan-view-contract";
import { type PlanOperationError } from "./planner/plan-operations";

export type PlanEditRequestResult =
  | { change: PlanChangeView | null; status: "applied" | "proposed" }
  | { error: PlanOperationError; status: "invalid" }
  | { status: "notFound" | "unauthorized" }
  | { status: "notUnderstood" }
  | RefusedUsage;

async function interpret({ context, text }: { context: PlanContext; text: string }) {
  const memory = await loadPlanMemory({
    goal: context.goal,
    need: `A change to the study plan: ${text}`,
  });

  return interpretPlanEdit({ ...toPlanEditInput(context), memory, request: text });
}

/**
 * Changes a plan from the learner's plain words ("less on weekends", "focus on math"). A fast
 * model turns them into the same changes the plan's controls make, with one sentence saying what
 * changes; what memory holds about the learner's goals and routine fills in what the words leave
 * open ("less on my late days"). A change of at most one lesson applies at once with an undo; anything bigger comes
 * back as a proposal showing its effect on the end date, waiting for the learner's OK. Each
 * request is claimed as small AI help first.
 */
export async function requestPlanEdit({
  goalId,
  input,
}: {
  goalId: string;
  input: PlanEditRequestInput;
}): Promise<PlanEditRequestResult> {
  const owned = await findOwnedPlan({ goalId, timeZone: input.timeZone });

  if (owned.status !== "ready") {
    return owned;
  }

  const usage = await claimAssist();

  if (usage.status !== "allowed") {
    return usage;
  }

  const { data, provenance } = await interpret({ context: owned.context, text: input.text });

  if (!data.understood) {
    return { status: "notUnderstood" };
  }

  const result = await withPlanRetry(async () => {
    const context = await loadPlanContext({ goal: owned.context.goal, timeZone: input.timeZone });

    if (!context) {
      return { status: "notFound" as const };
    }

    return proposeChange({
      context,
      operations: data.operations,
      provenance: toProvenanceData(provenance),
      reason: data.summary,
      source: "planEdit",
    });
  });

  if (result.status === "invalid" || result.status === "notFound") {
    return result;
  }

  if (result.status === "saved") {
    return { change: null, status: "applied" };
  }

  return { change: await loadPlanChangeView(result.changeId), status: result.status };
}

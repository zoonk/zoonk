import "server-only";
import { prisma } from "@zoonk/db";
import { type PlanOperation } from "../plan-contract";
import { needsApproval } from "../planner/plan-effect";
import { type PlanOperationError, applyPlanOperations } from "../planner/plan-operations";
import { type PlanState } from "../planner/plan-state";
import { type PlanChangeSource, toPlanChangePayload } from "./plan-change-payload";
import { type PlanContext, getStateTargetDate } from "./plan-context";
import {
  type ComputedPlan,
  type PlanChangeRecord,
  commitPlan,
  computePlan,
  revalidatePlanTags,
} from "./replan";

type Provenance = NonNullable<PlanChangeRecord["provenance"]>;

export type AppliedChange =
  | { changeId: string; status: "applied" | "proposed" }
  | { error: PlanOperationError; status: "invalid" };

/** A plan is ready once its graph has skills; before that, a change only updates the settings. */
export function isPlanReady(context: Pick<PlanContext, "state">): boolean {
  return context.state.graph.skills.length > 0;
}

/**
 * Saves a new state on a plan the planner hasn't built yet: the goal's time and the settings, so
 * the plan is built from them when it is.
 */
async function saveUnbuiltState({ context, state }: { context: PlanContext; state: PlanState }) {
  await prisma.$transaction([
    prisma.goal.update({
      data: { dailyMinutes: state.goal.dailyMinutes, targetDate: getStateTargetDate(state) },
      where: { id: context.goal.id },
    }),
    prisma.plan.update({ data: { settings: state.settings }, where: { id: context.plan.id } }),
  ]);

  revalidatePlanTags(context.goal.userId);
}

type ChangeRequest = {
  context: PlanContext;
  operations: readonly PlanOperation[];
  provenance?: Provenance | null;
  reason: string;
  source: PlanChangeSource;
};

/** Saves a computed edit and records it with the state its undo restores. */
async function commitEdit({
  computed,
  context,
  operations,
  provenance = null,
  reason,
  source,
}: ChangeRequest & { computed: ComputedPlan }): Promise<AppliedChange> {
  const changeId = await commitPlan({
    change: {
      kind: "edited",
      payload: toPlanChangePayload({
        before: context.state,
        effect: computed.effect,
        operations: [...operations],
        source,
      }),
      provenance,
      reason,
      status: "applied",
    },
    computed,
    context,
  });

  return { changeId: changeId ?? "", status: "applied" };
}

/**
 * Applies a change right away and re-plans from today, recording it with the state an undo
 * restores. Learners' own changes go through here; so do proposals small enough to need no OK.
 */
export async function applyChangeNow({
  context,
  operations,
  provenance = null,
  reason,
  source,
}: ChangeRequest): Promise<AppliedChange | { status: "saved" }> {
  const result = applyPlanOperations({ operations, state: context.state, today: context.today });

  if ("error" in result) {
    return { error: result.error, status: "invalid" };
  }

  if (!isPlanReady(context)) {
    await saveUnbuiltState({ context, state: result.state });
    return { status: "saved" };
  }

  const computed = await computePlan({ context, mode: "forced", state: result.state });

  return commitEdit({ computed, context, operations, provenance, reason, source });
}

/**
 * A change someone other than the learner suggests (the plan-edit AI, memory, a rebalance): applied
 * at once when it moves at most a lesson and the end date by a day, otherwise stored as a proposal
 * with its effect, waiting for the learner's OK.
 */
export async function proposeChange({
  context,
  operations,
  provenance = null,
  reason,
  source,
}: ChangeRequest): Promise<AppliedChange | { status: "saved" }> {
  const result = applyPlanOperations({ operations, state: context.state, today: context.today });

  if ("error" in result) {
    return { error: result.error, status: "invalid" };
  }

  if (!isPlanReady(context)) {
    return applyChangeNow({ context, operations, provenance, reason, source });
  }

  const computed = await computePlan({ context, mode: "forced", state: result.state });

  if (!needsApproval(computed.effect)) {
    return commitEdit({ computed, context, operations, provenance, reason, source });
  }

  const change = await prisma.planChange.create({
    data: {
      kind: "edited",
      payload: toPlanChangePayload({
        effect: computed.effect,
        operations: [...operations],
        source,
      }),
      planId: context.plan.id,
      reason,
      status: "proposed",
      ...provenance,
    },
  });

  revalidatePlanTags(context.goal.userId);

  return { changeId: change.id, status: "proposed" };
}

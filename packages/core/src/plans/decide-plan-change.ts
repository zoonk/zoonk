import "server-only";
import { type PlanChange, prisma } from "@zoonk/db";
import { forgetAssumedSkills, loadPlanItemSkillIds } from "../learner/_utils/known-skills";
import { computeChange } from "./_utils/compute-change";
import { followPlanToday } from "./_utils/follow-plan-today";
import { findOwnedPlan, loadPlanChangeView } from "./_utils/owned-plan";
import { parsePlanChangePayload, toPlanChangePayload } from "./_utils/plan-change-payload";
import { canUndoChange } from "./_utils/plan-change-view";
import { type PlanContext } from "./_utils/plan-context";
import {
  commitPlan,
  computePlan,
  getVersionAfter,
  revalidatePlanTags,
  withPlanRetry,
} from "./_utils/replan";
import { type PlanChangeDecisionInput } from "./plan-contract";
import { type PlanChangeView } from "./plan-view-contract";
import { type PlanOperationError, applyPlanOperations } from "./planner/plan-operations";

export type PlanChangeDecisionResult =
  | { change: PlanChangeView; status: "updated" }
  | { error: PlanOperationError; status: "invalid" }
  | { status: "conflict" | "notFound" | "unauthorized" };

type Decision = { change: PlanChange; context: PlanContext };

/**
 * Applies a proposal the learner said OK to, on the plan as it is now; today's session follows it
 * (see `followPlanToday`).
 */
async function acceptProposal({ change, context }: Decision) {
  const payload = parsePlanChangePayload(change.payload);

  const result = applyPlanOperations({
    noticeGraph: payload.noticeGraph,
    operations: payload.operations,
    state: context.state,
    today: context.today,
  });

  if ("error" in result) {
    return { error: result.error, status: "invalid" as const };
  }

  const { computed, effect } = await computeChange({
    context,
    operations: payload.operations,
    state: result.state,
  });

  await commitPlan({
    change: null,
    computed,
    context,
    extraWrites: (tx) =>
      tx.planChange.update({
        data: {
          payload: toPlanChangePayload({
            ...payload,
            before: context.state,
            effect,
            versionAfter: getVersionAfter(context),
          }),
          status: "applied",
        },
        where: { id: change.id },
      }),
  });

  await followPlanToday({ changeId: change.id, context });

  return null;
}

/** Brings back the state before an edit; what was done since stays done. */
async function undoEdit({ change, context }: Decision) {
  const { before } = parsePlanChangePayload(change.payload);

  if (!before) {
    return { status: "conflict" as const };
  }

  const computed = await computePlan({ context, mode: "forced", state: before });

  await commitPlan({
    change: null,
    computed,
    context,
    extraWrites: (tx) =>
      tx.planChange.update({ data: { status: "undone" }, where: { id: change.id } }),
  });

  await followPlanToday({ context });

  return null;
}

/**
 * Puts the lessons a test-out skipped back in the plan, for a learner who wants them anyway, and
 * forgets the skills the skip only assumed known.
 */
async function undoTestOut({ change, context }: Decision) {
  const ids = new Set(parsePlanChangePayload(change.payload).planItemIds);
  const skillIds = await loadPlanItemSkillIds({ goalId: context.goal.id, planItemIds: [...ids] });

  const items = context.items.map((item) =>
    ids.has(item.id) && item.status === "testedOut"
      ? { ...item, completedAt: null, status: "todo" as const }
      : item,
  );

  const restored = { ...context, items };
  const computed = await computePlan({ context: restored, mode: "forced" });

  await commitPlan({
    change: null,
    computed,
    context: restored,
    extraWrites: async (tx) => {
      await tx.planItem.updateMany({
        data: { completedAt: null, status: "todo" },
        where: { id: { in: [...ids] }, planId: context.plan.id, status: "testedOut" },
      });

      await forgetAssumedSkills({ skillIds, tx, userId: context.goal.userId });
      await tx.planChange.update({ data: { status: "undone" }, where: { id: change.id } });
    },
  });

  await followPlanToday({ context: restored });

  return null;
}

async function decline({ change, context }: Decision) {
  await prisma.planChange.update({ data: { status: "declined" }, where: { id: change.id } });
  revalidatePlanTags(context.goal.userId);
  return null;
}

/** "Got it": the learner read an applied change, so the plan stops showing it. Nothing else moves. */
async function markSeen({ change, context }: Decision) {
  if (change.status !== "applied") {
    return { status: "conflict" as const };
  }

  await prisma.planChange.update({
    data: {
      payload: toPlanChangePayload({
        ...parsePlanChangePayload(change.payload),
        seenAt: new Date().toISOString(),
      }),
    },
    where: { id: change.id },
  });

  revalidatePlanTags(context.goal.userId);
  return null;
}

async function decide({ decision, input }: { decision: Decision; input: PlanChangeDecisionInput }) {
  const { change } = decision;

  if (input.status === "seen") {
    return markSeen(decision);
  }

  if (input.status !== "undone") {
    if (change.status !== "proposed") {
      return { status: "conflict" as const };
    }

    return input.status === "applied" ? acceptProposal(decision) : decline(decision);
  }

  if (!canUndoChange({ change, planVersion: decision.context.plan.version })) {
    return { status: "conflict" as const };
  }

  return change.kind === "testedOut" ? undoTestOut(decision) : undoEdit(decision);
}

/**
 * The learner's answer to a change: OK or no to a proposal, undo an applied change (the latest
 * edit, or a test-out's skipped lessons), or "Got it" on an applied one. Changes that already
 * moved on are a conflict.
 */
export async function decidePlanChange({
  changeId,
  goalId,
  input,
}: {
  changeId: string;
  goalId: string;
  input: PlanChangeDecisionInput;
}): Promise<PlanChangeDecisionResult> {
  return withPlanRetry(async () => {
    const owned = await findOwnedPlan({ goalId, timeZone: input.timeZone });

    if (owned.status !== "ready") {
      return owned;
    }

    const change = await prisma.planChange.findFirst({
      where: { id: changeId, planId: owned.context.plan.id },
    });

    if (!change) {
      return { status: "notFound" as const };
    }

    const refusal = await decide({ decision: { change, context: owned.context }, input });

    return refusal ?? { change: await loadPlanChangeView(change.id), status: "updated" as const };
  });
}

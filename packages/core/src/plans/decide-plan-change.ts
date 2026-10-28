import "server-only";
import { type PlanChange, prisma } from "@zoonk/db";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { commitPlan } from "./_utils/commit-plan";
import { computeChange } from "./_utils/compute-change";
import { followPlanToday } from "./_utils/follow-plan-today";
import { findOwnedPlan, loadPlanChangeView } from "./_utils/owned-plan";
import { applyChangeOperations } from "./_utils/part-areas";
import { parsePlanChangePayload, toPlanChangePayload } from "./_utils/plan-change-payload";
import { canUndoChange } from "./_utils/plan-change-view";
import { type PlanContext } from "./_utils/plan-context";
import { replaceWaitingProposals } from "./_utils/replace-waiting-proposals";
import { revalidatePlanTags } from "./_utils/replan";
import { getChangePlanning } from "./_utils/steered-areas";
import { undoChange } from "./_utils/undo-change";
import { PlanConflictError, withPlanRetry } from "./plan-conflict";
import { type PlanChangeDecisionInput } from "./plan-contract";
import { type PlanChangeView } from "./plan-view-contract";
import { type PlanOperationError } from "./planner/plan-operations";

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

  const result = await applyChangeOperations({
    context,
    noticeGraph: payload.noticeGraph,
    operations: payload.operations,
  });

  if ("error" in result) {
    return { error: result.error, status: "invalid" as const };
  }

  const { bringsBackSetAside, computed, effect } = await computeChange({
    context,
    operations: result.operations,
    state: result.state,
  });

  await commitPlan({
    change: null,
    computed,
    context,
    extraWrites: async (tx) => {
      const { count } = await tx.planChange.updateMany({
        data: {
          payload: toPlanChangePayload({
            ...payload,
            effect,
            fromProposal: true,
            versionAfter: context.plan.version + 1,
          }),
          status: "applied",
        },
        where: { id: change.id, planId: context.plan.id, status: "proposed" },
      });

      if (count === 0) {
        /** A decision committed during compute; the retry reads it as a conflict. */
        throw new PlanConflictError();
      }

      await replaceWaitingProposals({
        applied: true,
        except: change.id,
        operations: payload.operations,
        planId: context.plan.id,
        source: payload.source,
        tx,
      });
    },
    phaseDates: {
      ...getChangePlanning(payload.operations),
      pace: "saved",
      planning: {
        ...getChangePlanning(payload.operations),
        bringBackSetAside: bringsBackSetAside,
        state: computed.state,
      },
    },
    replacement: {
      applied: true,
      except: change.id,
      operations: payload.operations,
      source: payload.source,
    },
    restorable: change.id,
  });

  await followPlanToday({ changeId: change.id, context });

  return null;
}

async function decline({ change, context }: Decision) {
  const refusal = await writeLearnerChange({ userId: context.goal.userId }, async (tx) => {
    const { count } = await tx.planChange.updateMany({
      data: { status: "declined" },
      where: { id: change.id, planId: context.plan.id, status: "proposed" },
    });

    return count === 0 ? unchanged({ status: "conflict" }) : null;
  });

  if (!refusal) {
    revalidatePlanTags(context.goal.userId);
  }

  return refusal;
}

/** "Got it": the learner read an applied change, so the plan stops showing it. Nothing else moves. */
async function markSeen({ change, context }: Decision) {
  if (change.status !== "applied") {
    return { status: "conflict" as const };
  }

  const outcome = await writeLearnerChange({ userId: context.goal.userId }, async (tx) => {
    const current = await tx.planChange.findFirst({
      where: { id: change.id, planId: context.plan.id },
    });

    if (current?.status !== "applied") {
      return unchanged("conflict");
    }

    const payload = parsePlanChangePayload(current.payload);

    if (payload.seenAt !== null) {
      return unchanged("alreadySeen");
    }

    await tx.planChange.update({
      data: { payload: toPlanChangePayload({ ...payload, seenAt: new Date().toISOString() }) },
      where: { id: change.id },
    });

    return "seen" as const;
  });

  if (outcome === "conflict") {
    return { status: "conflict" as const };
  }

  if (outcome === "seen") {
    revalidatePlanTags(context.goal.userId);
  }

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

  return undoChange(decision);
}

/**
 * The learner's answer to a change: OK or no to a proposal, undo an applied change (the latest
 * edit, or a test-out's skipped lessons; an applied proposal waits for an answer again), or "Got
 * it" on an applied one. Changes that already moved on are a conflict.
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

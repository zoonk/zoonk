import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { markPlanWrite } from "./mark-plan-write";
import { preparePhaseDatesProposal } from "./phase-dates-proposal";
import { isUndoableChange } from "./plan-change-payload";
import { type PlanContext } from "./plan-context";
import { savePlanSnapshot } from "./plan-snapshot";
import { preparePlanWrite } from "./prepare-plan-write";
import { type ProposalReplacement } from "./replace-waiting-proposals";
import {
  type ComputedPlan,
  type PlanChangeRecord,
  type PlanTagRevalidation,
  revalidatePlanTags,
} from "./replan";
import { writePlan } from "./write-plan";

export async function commitPlan({
  change,
  computed,
  context,
  extraWrites,
  keepsOpenUndo,
  phaseDates,
  restorable = null,
  revalidation = "now",
  replacement,
}: {
  replacement?: ProposalReplacement;
  change: PlanChangeRecord | null;
  computed: ComputedPlan;
  context: PlanContext;
  extraWrites?: (tx: TransactionClient) => Promise<unknown>;
  keepsOpenUndo?: boolean;
  restorable?: string | null;
  phaseDates?: Pick<Parameters<typeof preparePhaseDatesProposal>[0], "mode" | "pace" | "planning">;
  revalidation?: PlanTagRevalidation;
}): Promise<string | null> {
  const prepared = await preparePlanWrite({
    computed,
    context: { ...context, plan: { ...context.plan, inputVersion: context.plan.inputVersion + 1 } },
    replacement,
  });

  const projected = {
    ...context,
    plan: {
      ...context.plan,
      inputVersion: context.plan.inputVersion + 1,
      version: context.plan.version + 1,
    },
  };

  const phaseWrite = await preparePhaseDatesProposal({
    computed,
    context: projected,
    mode: "automatic",
    pace: "saved",
    ...phaseDates,
  });

  const changeId = await prisma.$transaction(async (tx) => {
    const writeContext = { ...context, plan: await markPlanWrite(tx, context.plan) };

    await writePlan({ context: writeContext, keepsOpenUndo, plan: prepared, tx });

    await extraWrites?.(tx);
    await phaseWrite?.(tx);

    const created = change
      ? await tx.planChange.create({
          data: {
            kind: change.kind,
            payload: { ...change.payload, versionAfter: context.plan.version + 1 },
            planId: context.plan.id,
            reason: change.reason,
            status: change.status,
            ...change.provenance,
          },
        })
      : null;

    const undoable = created && isUndoableChange(created) ? created.id : restorable;

    if (undoable) {
      await savePlanSnapshot({ changeId: undoable, context, tx });
    }

    return created?.id ?? null;
  });

  if (revalidation === "now") {
    revalidatePlanTags(context.goal.userId);
  }

  return changeId;
}

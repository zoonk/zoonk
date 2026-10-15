import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { toComputedPlanWrite } from "../../plans/_utils/computed-plan-write";
import { getEstimateChange } from "../../plans/_utils/estimate-change";
import { parsePlanChangePayload } from "../../plans/_utils/plan-change-payload";
import { readFreshPlanSummary } from "../../plans/_utils/plan-summary";
import { type PlanChangeRecord } from "../../plans/_utils/replan";
import { getSettledPlanChange } from "../../plans/_utils/settled-change";
import { writePlan } from "../../plans/_utils/write-plan";
import { PHASE_DATES_SOURCE } from "../../plans/plan-change-contract";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { type SelectedDayPlan } from "./selected-day-plan";

export function getSelectedPlanChange(selection: SelectedDayPlan): PlanChangeRecord | null {
  const { computed, context, left } = selection;

  if (!computed) {
    return null;
  }

  if (left.length === 0) {
    return getEstimateChange({ computed, context });
  }

  return getSettledPlanChange({ computed, context, left });
}

export async function saveSelectedPlan({
  acknowledge,
  selection,
  shown,
  tx,
}: {
  acknowledge?: { revision: string; studyDay: string };
  selection: SelectedDayPlan;
  shown: boolean;
  tx: TransactionClient;
}): Promise<number> {
  const { computed, context } = selection;

  if (!shown) {
    return context.plan.version;
  }

  if (!computed) {
    const update = selection.inputKeyUpdate;

    const summary = readFreshPlanSummary({
      basis: {
        inputVersion: context.plan.inputVersion,
        planId: context.plan.id,
        planVersion: context.plan.version,
        studyDay: toIsoDate(context.today),
        timeZone: context.timeZone,
        userId: context.goal.userId,
      },
      value: context.plan.summary,
    });

    const selected = update?.summary ?? summary?.selected;

    if (selected || update) {
      await tx.plan.update({
        data: {
          ...(update && { graph: update.graph, inputsKey: update.inputsKey }),
          ...(selected && {
            summary: {
              basis: {
                inputVersion: context.plan.inputVersion + 1,
                planId: context.plan.id,
                planVersion: context.plan.version,
                studyDay: toIsoDate(context.today),
                timeZone: context.timeZone,
                userId: context.goal.userId,
              },
              schemaVersion: 1,
              selected,
            },
          }),
        },
        where: { id: context.plan.id },
      });
    }

    return context.plan.version;
  }

  const writeContext = {
    ...context,
    plan: { ...context.plan, inputVersion: context.plan.inputVersion + 1 },
  };

  await writePlan({
    context: writeContext,
    plan: toComputedPlanWrite({ computed, context: writeContext }),
    tx,
  });

  const change = getSelectedPlanChange(selection);

  if (change) {
    if ((parsePlanChangePayload(change.payload).effect?.phaseEnds?.length ?? 0) > 0) {
      await tx.planChange.updateMany({
        data: { status: "replaced" },
        where: {
          payload: { equals: PHASE_DATES_SOURCE, path: ["source"] },
          planId: context.plan.id,
          status: "proposed",
        },
      });
    }

    await tx.planChange.create({
      data: {
        kind: change.kind,
        payload: {
          ...change.payload,
          ...(acknowledge && { acknowledgedRead: acknowledge, seenAt: new Date().toISOString() }),
          versionAfter: context.plan.version + 1,
        },
        planId: context.plan.id,
        reason: change.reason,
        status: change.status,
      },
    });
  }

  return context.plan.version + 1;
}

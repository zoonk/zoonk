import "server-only";
import { prisma } from "@zoonk/db";
import { keepOpenSessionSelection } from "../sessions/_utils/skip-tested-out-blocks";
import { isPlanReady } from "./_utils/apply-plan-change";
import { commitPlan } from "./_utils/commit-plan";
import { parsePlanChangePayload } from "./_utils/plan-change-payload";
import { loadPlanAtToken } from "./_utils/plan-token";
import { computePlan } from "./_utils/replan";
import { withPlanRetry } from "./plan-conflict";

/** Rebuild the schedule before selecting lesson work, preserving the finish's Undo and open day. */
export async function refreshTestedOutPlan({ goalId, userId }: { goalId: string; userId: string }) {
  await withPlanRetry(async () => {
    const change = await prisma.planChange.findFirst({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { payload: true, plan: { select: { version: true } } },
      where: { kind: "testedOut", plan: { goal: { userId }, goalId }, status: "applied" },
    });

    const payload = parsePlanChangePayload(change?.payload);

    if (
      !change ||
      !payload.testReceipt ||
      payload.testOutRescheduled ||
      payload.replannedSince ||
      payload.versionAfter !== change.plan.version
    ) {
      return;
    }

    const context = await loadPlanAtToken(goalId);

    if (!context || context.plan.version !== change.plan.version || !isPlanReady(context)) {
      return;
    }

    const computed = await computePlan({ context, mode: "forced" });

    await commitPlan({
      change: null,
      computed,
      context,
      extraWrites: (tx) =>
        keepOpenSessionSelection(tx, { goalId, planVersion: context.plan.version + 1 }),
      keepsOpenUndo: "testOut",
    });
  });
}

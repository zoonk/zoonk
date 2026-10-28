import "server-only";
import { type PlanChange, type TransactionClient, prisma } from "@zoonk/db";
import { forgetAssumedSkills, loadPlanItemSkillIds } from "../../learner/_utils/known-skills";
import { lockDaySession, restoreDaySession } from "../../sessions/_utils/day-session-snapshot";
import { settleSessionDay } from "../../sessions/_utils/settle-session-day";
import { refreshSavedGoalPlanAdvice } from "../refresh-goal-plan";
import { getChangeLevers, replacesProposal } from "./change-levers";
import { followPlanToday } from "./follow-plan-today";
import { markPlanWrite } from "./mark-plan-write";
import { parsePlanChangePayload, toPlanChangePayload } from "./plan-change-payload";
import { type PlanContext } from "./plan-context";
import { revalidatePlanTags } from "./replan";
import { canRestore, loadPlanSnapshot, restorePlan } from "./restore-plan";

async function isAskedAgain({
  change,
  tx,
}: {
  change: PlanChange;
  tx: TransactionClient;
}): Promise<boolean> {
  const payload = parsePlanChangePayload(change.payload);
  const levers = getChangeLevers({ operations: payload.operations, source: payload.source });

  const waiting = await tx.planChange.findMany({
    select: { payload: true },
    where: { id: { not: change.id }, planId: change.planId, status: "proposed" },
  });

  return waiting.some((other) => {
    const newer = parsePlanChangePayload(other.payload);

    return replacesProposal({
      newer: getChangeLevers({ operations: newer.operations, source: newer.source }),
      waiting: levers,
    });
  });
}

async function toUndone({ change, tx }: { change: PlanChange; tx: TransactionClient }) {
  const payload = parsePlanChangePayload(change.payload);

  if (!payload.fromProposal) {
    return { status: "undone" as const };
  }

  if (await isAskedAgain({ change, tx })) {
    return { status: "replaced" as const };
  }

  return {
    payload: toPlanChangePayload({
      ...payload,
      fromProposal: false,
      seenAt: null,
      todaySession: null,
      versionAfter: null,
    }),
    status: "proposed" as const,
  };
}

export async function undoChange({
  change,
  context,
}: {
  change: PlanChange;
  context: PlanContext;
}) {
  const snapshot = await loadPlanSnapshot(change.id);

  if (!snapshot || !(await canRestore(snapshot))) {
    return { status: "conflict" as const };
  }

  const skipped = new Set(
    change.kind === "testedOut" ? parsePlanChangePayload(change.payload).planItemIds : [],
  );

  const skillIds =
    skipped.size > 0
      ? await loadPlanItemSkillIds({ goalId: context.goal.id, planItemIds: [...skipped] })
      : [];

  const items = snapshot.items.map((item) =>
    skipped.has(item.id) && item.status === "testedOut"
      ? { ...item, completedAt: null, status: "todo" as const }
      : item,
  );

  const restored = await prisma.$transaction(async (tx) => {
    const writeContext = { ...context, plan: await markPlanWrite(tx, context.plan) };

    const session =
      snapshot.todaySession &&
      (await lockDaySession({
        goalId: context.goal.id,
        localDate: context.today,
        snapshot: snapshot.todaySession,
        tx,
        userId: context.goal.userId,
      }));

    await restorePlan({ context: writeContext, items, snapshot, tx });
    await forgetAssumedSkills({ skillIds, tx, userId: context.goal.userId });
    await tx.planChange.update({ data: await toUndone({ change, tx }), where: { id: change.id } });

    return session && snapshot.todaySession
      ? {
          sessionId: session.id,
          settle: await restoreDaySession({ session, snapshot: snapshot.todaySession, tx }),
        }
      : null;
  });

  await refreshSavedGoalPlanAdvice(context.goal.id);
  revalidatePlanTags(context.goal.userId);

  if (!restored) {
    await followPlanToday({ context });
  } else if (restored.settle) {
    await settleSessionDay({
      sessionId: restored.sessionId,
      timeZone: context.timeZone,
      userId: context.goal.userId,
    });
  }

  return null;
}

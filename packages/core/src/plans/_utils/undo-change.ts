import "server-only";
import { type PlanChange, type TransactionClient, prisma } from "@zoonk/db";
import { oweGoalLessons } from "../../follow-ups/owe-goal-lessons";
import { forgetAssumedSkills, loadPlanItemSkillIds } from "../../learner/_utils/known-skills";
import { findOldTestFocus, keepTestFocus } from "../../learner/placement/_utils/focus-test-record";
import { FOCUS_TEST_SOURCE } from "../../learner/placement/focus-test-contract";
import { readFocusTestRecord } from "../../learner/placement/focus-test-state";
import { lockDaySession, restoreDaySession } from "../../sessions/_utils/day-session-snapshot";
import { settleSessionDay } from "../../sessions/_utils/settle-session-day";
import { keepOpenSessionSelection } from "../../sessions/_utils/skip-tested-out-blocks";
import { refreshGoalPlan, refreshSavedGoalPlanAdvice } from "../refresh-goal-plan";
import { getChangeLevers, replacesProposal } from "./change-levers";
import { followPlanToday } from "./follow-plan-today";
import { markPlanWrite } from "./mark-plan-write";
import { parsePlanChangePayload, toPlanChangePayload } from "./plan-change-payload";
import { type PlanContext } from "./plan-context";
import { revalidatePlanTags } from "./replan";
import { canRestore, loadPlanSnapshot, restorePlan } from "./restore-plan";
import { undoTestOutResult } from "./undo-test-out-result";

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

  if (!payload.fromProposal || payload.source === FOCUS_TEST_SOURCE) {
    return { status: "undone" as const };
  }

  if (await isAskedAgain({ change, tx })) {
    return { status: "replaced" as const };
  }

  const { replannedSince: _replannedSince, ...asked } = payload;

  return {
    payload: toPlanChangePayload({
      ...asked,
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

  const payload = parsePlanChangePayload(change.payload);

  const keepSession = payload.todaySession === "unchanged";

  const skipped = new Set(
    change.kind === "testedOut" || payload.livingPlanDay ? payload.planItemIds : [],
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
      !keepSession &&
      snapshot.todaySession &&
      (await lockDaySession({
        goalId: context.goal.id,
        localDate: context.today,
        snapshot: snapshot.todaySession,
        tx,
        userId: context.goal.userId,
      }));

    const returned = new Set(payload.livingPlanDay ? payload.carriedItemIds : []);

    const testedOut = Map.groupBy(
      items.filter((item) => returned.has(item.id) && item.status === "testedOut"),
      (item) => item.completedAt?.toISOString(),
    );

    for (const [completedAt, group] of testedOut) {
      // oxlint-disable-next-line no-await-in-loop -- Restore the snapshot dates under the plan lock.
      await tx.planItem.updateMany({
        data: { completedAt: completedAt ? new Date(completedAt) : null, status: "testedOut" },
        where: {
          id: { in: group.map((item) => item.id) },
          planId: context.plan.id,
          status: "todo",
        },
      });
    }

    await restorePlan({ context: writeContext, items, snapshot, tx });

    if (keepSession) {
      await keepOpenSessionSelection(tx, {
        goalId: context.goal.id,
        planVersion: context.plan.version + 1,
      });
    }

    await forgetAssumedSkills({ skillIds, tx, userId: context.goal.userId });
    const undone = await toUndone({ change, tx });

    await tx.planChange.update({
      data:
        (change.kind === "testedOut" || payload.livingPlanDay) && undone.status === "undone"
          ? {
              ...undone,
              payload: toPlanChangePayload({
                ...parsePlanChangePayload(change.payload),
                undoneAt: new Date().toISOString(),
              }),
            }
          : undone,
      where: { id: change.id },
    });

    if (payload.testReceipt && undone.status === "undone") {
      await undoTestOutResult({
        goalId: context.goal.id,
        lessonsSkipped: payload.lessonsSkipped ?? 0,
        receipt: payload.testReceipt,
        tx,
      });
    }

    if (context.goal.kind === "exam" && readFocusTestRecord(context.goal)) {
      await keepTestFocus({
        areas:
          snapshot.testFocus === undefined
            ? await findOldTestFocus({ goalId: context.goal.id, tx })
            : snapshot.testFocus,
        goalId: context.goal.id,
        tx,
        userId: context.goal.userId,
      });
    }

    await oweGoalLessons({ db: tx, goalId: context.goal.id, userId: context.goal.userId });

    return session && snapshot.todaySession
      ? {
          sessionId: session.id,
          settle: await restoreDaySession({ session, snapshot: snapshot.todaySession, tx }),
        }
      : null;
  });

  if (parsePlanChangePayload(change.payload).replannedSince) {
    await refreshGoalPlan({ goalId: context.goal.id, settleMissedDays: false });
  }

  await refreshSavedGoalPlanAdvice(context.goal.id);
  revalidatePlanTags(context.goal.userId);

  if (!restored && !keepSession) {
    await followPlanToday({ context });
  } else if (restored?.settle) {
    await settleSessionDay({
      sessionId: restored.sessionId,
      timeZone: context.timeZone,
      userId: context.goal.userId,
    });
  }

  return null;
}

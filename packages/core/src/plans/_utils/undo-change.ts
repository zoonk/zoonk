import "server-only";
import { type PlanChange, type TransactionClient, prisma } from "@zoonk/db";
import { testEventContext, trackTestEvents } from "../../analytics/test-events";
import { removeUnstartedMockBlocks } from "../../checkpoints/_utils/mock-schedule-blocks";
import { oweGoalLessons } from "../../follow-ups/owe-goal-lessons";
import { forgetAssumedSkills, loadPlanItemSkillIds } from "../../learner/_utils/known-skills";
import { findOldTestFocus, keepTestFocus } from "../../learner/placement/_utils/focus-test-record";
import { FOCUS_TEST_SOURCE } from "../../learner/placement/focus-test-contract";
import { readFocusTestRecord } from "../../learner/placement/focus-test-state";
import { lockDaySession, restoreDaySession } from "../../sessions/_utils/day-session-snapshot";
import { settleSessionDay } from "../../sessions/_utils/settle-session-day";
import { keepOpenSessionSelection } from "../../sessions/_utils/skip-tested-out-blocks";
import { PlanConflictError, unlessPlanConflict } from "../plan-conflict";
import { fromIsoDate } from "../planner/plan-calendar";
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

async function undoTestAnalytics({
  goal,
  payload,
  tx,
}: {
  goal: PlanContext["goal"];
  payload: ReturnType<typeof parsePlanChangePayload>;
  tx: TransactionClient;
}) {
  if (payload.testReceipt) {
    return undoTestOutResult({
      goal,
      lessonsSkipped: payload.lessonsSkipped ?? 0,
      receipt: payload.testReceipt,
      tx,
    });
  }

  return payload.source === FOCUS_TEST_SOURCE
    ? testEventContext(goal, { questions: null, test: "focus" })
    : null;
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

  const restoresTestOut = change.kind === "testedOut" || Boolean(payload.livingPlanDay);
  const skipped = new Set(restoresTestOut ? payload.planItemIds : []);

  const skillIds =
    skipped.size > 0
      ? await loadPlanItemSkillIds({ goalId: context.goal.id, planItemIds: [...skipped] })
      : [];

  const items = snapshot.items.map((item) =>
    skipped.has(item.id) && item.status === "testedOut"
      ? { ...item, completedAt: null, status: "todo" as const }
      : item,
  );

  const returned = new Set(payload.livingPlanDay ? payload.carriedItemIds : []);

  const testedOut = Map.groupBy(
    items.filter((item) => returned.has(item.id) && item.status === "testedOut"),
    (item) => item.completedAt?.toISOString(),
  );

  const { restored, test: testContext } = await prisma.$transaction(async (tx) => {
    const writeContext = { ...context, plan: await markPlanWrite(tx, context.plan) };

    const scheduled = payload.mockSchedule;

    if (scheduled?.to) {
      const moved = await tx.planItem.findFirst({
        select: { id: true, status: true },
        where: { kind: "mock", planId: change.planId, scheduledFor: fromIsoDate(scheduled.to) },
      });

      if (!moved || moved.status !== "todo") {
        throw new PlanConflictError();
      }

      await removeUnstartedMockBlocks({
        goalId: context.goal.id,
        planItemId: moved.id,
        today: context.today,
        tx,
      });
    }

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
        restoresTestOut && undone.status === "undone"
          ? {
              ...undone,
              payload: toPlanChangePayload({ ...payload, undoneAt: new Date().toISOString() }),
            }
          : undone,
      where: { id: change.id },
    });

    const test =
      undone.status === "undone"
        ? await undoTestAnalytics({ goal: context.goal, payload, tx })
        : null;

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

    return {
      restored:
        session && snapshot.todaySession
          ? {
              sessionId: session.id,
              settle: await restoreDaySession({ session, snapshot: snapshot.todaySession, tx }),
            }
          : null,
      test,
    };
  });

  if (testContext) {
    trackTestEvents(context.goal, [
      {
        name: "Test Result Undone",
        properties: {
          ...testContext,
          change_id: change.id,
          lessons_restored: payload.lessonsSkipped ?? 0,
        },
      },
    ]);
  }

  if (payload.replannedSince) {
    await refreshGoalPlan({
      goalId: context.goal.id,
      onConflict: "yield",
      settleMissedDays: false,
    });
  }

  await unlessPlanConflict(() => refreshSavedGoalPlanAdvice(context.goal.id));
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

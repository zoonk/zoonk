import "server-only";
import { type PlanChange, type TransactionClient, prisma } from "@zoonk/db";
import { forgetAssumedSkills, loadPlanItemSkillIds } from "../../learner/_utils/known-skills";
import { lockDaySession, restoreDaySession } from "../../sessions/_utils/day-session-snapshot";
import { settleSessionDay } from "../../sessions/_utils/settle-session-day";
import { getChangeLevers, replacesProposal } from "./change-levers";
import { followPlanToday } from "./follow-plan-today";
import { parsePlanChangePayload, toPlanChangePayload } from "./plan-change-payload";
import { type PlanContext } from "./plan-context";
import { revalidatePlanTags } from "./replan";
import { canRestore, loadPlanSnapshot, restorePlan } from "./restore-plan";

/**
 * Whether a proposal waiting now changes something the given-back one changes too (see
 * `replacesProposal`): the newer question wins, as when it was proposed, so the learner never
 * answers two that contradict ("30 minutes a day", then "an hour a day").
 */
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

/**
 * What the change becomes once undone: an applied proposal waits for the learner's answer again,
 * as it did before Apply, with nothing left to restore until it applies again, unless a newer
 * suggestion asks about the same thing (`replaced`, see `isAskedAgain`); any other change is
 * `undone`. Ana undid Today's rest-day suggestion and it was gone until she reloaded, though
 * nothing she chose had changed (Gmail's and Linear's undo give the prompt back too).
 */
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

/**
 * Puts the plan back as it was right before an edit or a test-out (see `PlanSnapshot`): every item
 * on its day with its status, and the phase ends, state and numbers it had. What the learner
 * finished since stays done. A test-out's skipped lessons are todo again where they were, and the
 * skills it only assumed known are forgotten: put back by planning again, they landed as todo rows
 * on day one beside a plan laid out without them. Today's session comes back as it was too (see
 * `restoreDaySession`); on another day, or for a day built after the change, it follows the plan.
 * An applied proposal waits for an answer again (see `toUndone`).
 */
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
    // Guest linking moves learner rows under an exclusive owner lock.
    await tx.$queryRaw`
      SELECT id FROM users WHERE id = ${context.goal.userId}::uuid FOR KEY SHARE
    `;

    const session =
      snapshot.todaySession &&
      (await lockDaySession({
        goalId: context.goal.id,
        localDate: context.today,
        snapshot: snapshot.todaySession,
        tx,
        userId: context.goal.userId,
      }));

    await restorePlan({ context, items, snapshot, tx });
    await forgetAssumedSkills({ skillIds, tx, userId: context.goal.userId });
    await tx.planChange.update({ data: await toUndone({ change, tx }), where: { id: change.id } });

    return session && snapshot.todaySession
      ? {
          sessionId: session.id,
          settle: await restoreDaySession({ session, snapshot: snapshot.todaySession, tx }),
        }
      : null;
  });

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

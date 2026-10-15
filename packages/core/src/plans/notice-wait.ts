import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { revalidatePlanTags } from "./_utils/replan";
import { type PlanView } from "./plan-view-contract";

/**
 * How long an exam plan built before research read the exam's notice waits for that reading. It
 * starts when the plan is built, about a minute and a half after the goal; the learner reaches the
 * reveal after placement, a few minutes later. Reading a notice took under 4 minutes for the PF's
 * and 7 for the OAB's whole notice on the dev server (5 Oct 2026), and the reading then takes a
 * minute or two to land in the plan.
 */
const NOTICE_WAIT_MS = 360_000;

/**
 * A reading that lands in time keeps the reveal waiting while the plan is checked against it and
 * built again with it: the check took up to 4 minutes for the Câmara's notice on the dev server
 * (7 Oct 2026), and building the plan again a few seconds.
 */
const LANDING_MS = 300_000;

/**
 * The reveal stopped waiting before research's reading landed in the plan: the learner may have
 * seen it, so the reading waits on Today as a change to apply instead (see `proposeNoticeChange`).
 */
class NoticeLandingExpiredError extends Error {
  constructor() {
    super("The plan stopped waiting for the notice's reading before it landed.");
    this.name = "NoticeLandingExpiredError";
  }
}

/** Whether a reading came too late to land in the plan (see `NoticeLandingExpiredError`). */
export function isNoticeLandingExpiredError(error: unknown): boolean {
  return error instanceof NoticeLandingExpiredError;
}

/**
 * Throws unless the plan still waits for the notice's reading, read in the transaction that writes
 * the plan, once it holds the plan: the wait that `claimNoticeLanding` extended may have run out
 * while the plan was built again, or while its write waited to be tried again.
 */
export async function checkNoticeLanding(tx: TransactionClient, planId: string): Promise<void> {
  const plan = await tx.plan.findUnique({
    select: { noticeWaitUntil: true },
    where: { id: planId },
  });

  if (!plan?.noticeWaitUntil || plan.noticeWaitUntil <= new Date()) {
    throw new NoticeLandingExpiredError();
  }
}

/**
 * Where a plan stands with its exam's notice: `reading` while the reveal waits for research to read
 * it, `usual` once the wait ended without it (the plan follows the exam's usual structure, and the
 * reading arrives as a change to apply), null when there's nothing to wait for.
 */
export function getNoticeWaitState({
  noticeWaitUntil,
  now,
}: {
  noticeWaitUntil: Date | null;
  now: Date;
}): PlanView["notice"] {
  if (!noticeWaitUntil) {
    return null;
  }

  return noticeWaitUntil > now ? "reading" : "usual";
}

async function revalidateGoalPlan(goalId: string) {
  const goal = await prisma.goal.findUnique({ select: { userId: true }, where: { id: goalId } });

  if (goal) {
    revalidatePlanTags(goal.userId);
  }
}

/**
 * The goal's plan, just built before research read the exam's notice, waits for that reading: the
 * reveal says it's reading the notice until it lands or the wait runs out. A bridge for the goal's
 * content workflow.
 */
export async function startNoticeWait({
  goalId,
  now = new Date(),
}: {
  goalId: string;
  now?: Date;
}): Promise<void> {
  const goal = await prisma.goal.findUnique({
    include: { plan: { select: { id: true } } },
    where: { id: goalId },
  });

  if (!goal?.plan) {
    return;
  }

  const planId = goal.plan.id;

  const until = new Date(now.getTime() + NOTICE_WAIT_MS);

  await writeLearnerChange({ lockPlanIds: [planId], userId: goal.userId }, async (tx) => {
    const updated = await tx.plan.updateMany({
      data: { noticeWaitUntil: until },
      where: { OR: [{ noticeWaitUntil: null }, { noticeWaitUntil: { not: until } }], id: planId },
    });

    if (updated.count === 0) {
      return unchanged(null);
    }
  });

  await revalidateGoalPlan(goalId);
}

/**
 * Whether research's reading of the notice still lands before the learner saw the plan: true while
 * the wait runs, and then the wait holds a little longer so the reveal keeps waiting while the plan
 * is built again; false once it ran out, when the reading arrives as a change the learner applies.
 */
export async function claimNoticeLanding({
  goalId,
  now = new Date(),
}: {
  goalId: string;
  now?: Date;
}): Promise<boolean> {
  const goal = await prisma.goal.findUnique({
    include: { plan: { select: { id: true } } },
    where: { id: goalId },
  });

  if (!goal?.plan) {
    return false;
  }

  const planId = goal.plan.id;

  return writeLearnerChange({ lockPlanIds: [planId], userId: goal.userId }, async (tx) => {
    const plan = await tx.plan.findUnique({ where: { id: planId } });

    if (!plan?.noticeWaitUntil || plan.noticeWaitUntil <= now) {
      return unchanged(false);
    }

    const until = new Date(now.getTime() + LANDING_MS);

    if (plan.noticeWaitUntil.getTime() === until.getTime()) {
      return unchanged(true);
    }

    await tx.plan.update({ data: { noticeWaitUntil: until }, where: { id: plan.id } });
    return true;
  });
}

/**
 * The plan stops waiting for the notice: its reading landed, arrived as a change to apply, or
 * research ended without one. When it stopped is kept: notices recorded before then are the
 * plan's own, never news on Today (see `listGoalChangeNotices`).
 */
export async function endNoticeWait(goalId: string): Promise<void> {
  const goal = await prisma.goal.findUnique({
    include: { plan: { select: { id: true } } },
    where: { id: goalId },
  });

  if (!goal?.plan) {
    return;
  }

  const planId = goal.plan.id;

  const count = await writeLearnerChange(
    { lockPlanIds: [planId], userId: goal.userId },
    async (tx) => {
      const updated = await tx.plan.updateMany({
        data: { noticeWaitEndedAt: new Date(), noticeWaitUntil: null },
        where: { id: planId, noticeWaitUntil: { not: null } },
      });

      return updated.count > 0 ? updated.count : unchanged(0);
    },
  );

  if (count > 0) {
    await revalidateGoalPlan(goalId);
  }
}

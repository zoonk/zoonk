import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { revalidatePlanTags } from "./_utils/replan";
import { type PlanView } from "./plan-view-contract";

const NOTICE_WAIT_MS = 360_000;

const LANDING_MS = 300_000;

class NoticeLandingExpiredError extends Error {
  constructor() {
    super("The plan stopped waiting for the notice's reading before it landed.");
    this.name = "NoticeLandingExpiredError";
  }
}

export function isNoticeLandingExpiredError(error: unknown): boolean {
  return error instanceof NoticeLandingExpiredError;
}

/**
 * Throws unless the plan still waits for the notice's reading; call it in the transaction that
 * writes the plan.
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

/** Workflow bridge for the goal's content workflow. */
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

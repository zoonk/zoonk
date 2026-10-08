import "server-only";
import { prisma } from "@zoonk/db";
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
  await prisma.plan.updateMany({
    data: { noticeWaitUntil: new Date(now.getTime() + NOTICE_WAIT_MS) },
    where: { goalId },
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
  const { count } = await prisma.plan.updateMany({
    data: { noticeWaitUntil: new Date(now.getTime() + LANDING_MS) },
    where: { goalId, noticeWaitUntil: { gt: now } },
  });

  return count > 0;
}

/**
 * The plan stops waiting for the notice: its reading landed, arrived as a change to apply, or
 * research ended without one. When it stopped is kept: notices recorded before then are the
 * plan's own, never news on Today (see `listGoalChangeNotices`).
 */
export async function endNoticeWait(goalId: string): Promise<void> {
  const { count } = await prisma.plan.updateMany({
    data: { noticeWaitEndedAt: new Date(), noticeWaitUntil: null },
    where: { goalId, noticeWaitUntil: { not: null } },
  });

  if (count > 0) {
    await revalidateGoalPlan(goalId);
  }
}

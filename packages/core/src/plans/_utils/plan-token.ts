import "server-only";
import { prisma } from "@zoonk/db";
import { type PlanContext, loadPlanContext } from "./plan-context";

/**
 * The goal's plan context, read after the plan's token, which it carries. Everything a run plans
 * from is read after the token, and every write to it bumps the plan's input version in its own
 * transaction (see `markPlansChanged`), so a write that lands meanwhile fails the commit's check
 * instead of being planned over. Read the other way round, a learner's change between reading the
 * goal and reading the plan would pass the check with the goal as it was. Null without a plan.
 */
export async function loadPlanAtToken(
  goalId: string,
  options: { now?: Date; timeZone?: string | null } = {},
): Promise<PlanContext | null> {
  const token = await prisma.plan.findUnique({
    select: { inputVersion: true, version: true },
    where: { goalId },
  });

  const goal = token ? await prisma.goal.findUnique({ where: { id: goalId } }) : null;
  const context = goal ? await loadPlanContext({ goal, ...options }) : null;

  return context && token ? { ...context, plan: { ...context.plan, ...token } } : null;
}

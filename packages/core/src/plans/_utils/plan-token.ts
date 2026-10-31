import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { type PlanContext, loadPlanContext } from "./plan-context";

/**
 * Reads the plan's token before anything a run plans from, so a write landing meanwhile fails the
 * commit's check.
 */
export async function loadPlanAtToken(
  goalId: string,
  options: {
    now?: Date;
    timeZone?: string | null;
    goalChanges?: Partial<Pick<Goal, "details" | "status" | "studyTime" | "timezone" | "title">>;
  } = {},
): Promise<PlanContext | null> {
  const token = await prisma.plan.findUnique({
    select: { inputVersion: true, version: true },
    where: { goalId },
  });

  const goal = token ? await prisma.goal.findUnique({ where: { id: goalId } }) : null;
  const { goalChanges, ...readOptions } = options;

  const changes = Object.fromEntries(
    Object.entries(goalChanges ?? {}).filter(([, value]) => value !== undefined),
  );

  const context = goal
    ? await loadPlanContext({ goal: { ...goal, ...changes }, ...readOptions })
    : null;

  return context && token ? { ...context, plan: { ...context.plan, ...token } } : null;
}

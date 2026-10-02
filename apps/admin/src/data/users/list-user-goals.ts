import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

const RECENT_PLAN_CHANGES = 20;

/**
 * The learner's goals with their plans (version, estimate, done and total items) and the latest
 * plan changes with their reasons, so support can see how a plan got where it is.
 */
export const listUserGoals = cacheAdminData(async (userId: string) => {
  const goals = await prisma.goal.findMany({
    include: {
      examBlueprint: { select: { id: true, name: true } },
      plan: {
        include: {
          _count: { select: { items: true } },
          changes: { orderBy: { createdAt: "desc" }, take: RECENT_PLAN_CHANGES },
        },
        omit: { graph: true, phases: true, settings: true },
      },
      primaryCourse: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    where: { userId },
  });

  const planIds = goals.flatMap((goal) => (goal.plan ? [goal.plan.id] : []));

  const doneItems = await prisma.planItem.groupBy({
    _count: { id: true },
    by: ["planId"],
    where: { planId: { in: planIds }, status: { in: ["done", "testedOut"] } },
  });

  const doneByPlan = new Map(doneItems.map((row) => [row.planId, row._count.id]));

  return goals.map((goal) => ({
    ...goal,
    doneItems: goal.plan ? (doneByPlan.get(goal.plan.id) ?? 0) : 0,
  }));
});

export type UserGoal = Awaited<ReturnType<typeof listUserGoals>>[number];

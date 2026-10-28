import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

const RECENT_PLAN_CHANGES = 20;

export const listUserGoals = cacheAdminData(async (userId: string) => {
  const goals = await prisma.goal.findMany({
    include: {
      examBlueprint: { select: { id: true, name: true } },
      plan: {
        include: { changes: { orderBy: { createdAt: "desc" }, take: RECENT_PLAN_CHANGES } },
        omit: { graph: true, phases: true, settings: true },
      },
      primaryCourse: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    where: { userId },
  });

  const planIds = goals.flatMap((goal) => (goal.plan ? [goal.plan.id] : []));

  // Counted for these plans only: a relation `_count` would count every plan's items.
  const itemCounts = await prisma.planItem.groupBy({
    _count: { id: true },
    by: ["planId", "status"],
    where: { planId: { in: planIds } },
  });

  const countItems = (planId: string, statuses?: readonly string[]) =>
    itemCounts
      .filter((row) => row.planId === planId && (!statuses || statuses.includes(row.status)))
      .reduce((total, row) => total + row._count.id, 0);

  return goals.map((goal) => ({
    ...goal,
    doneItems: goal.plan ? countItems(goal.plan.id, ["done", "testedOut"]) : 0,
    totalItems: goal.plan ? countItems(goal.plan.id) : 0,
  }));
});

export type UserGoal = Awaited<ReturnType<typeof listUserGoals>>[number];

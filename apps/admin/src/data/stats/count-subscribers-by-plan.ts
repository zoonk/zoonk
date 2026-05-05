import "server-only";
import { adminStatsCache as cache } from "@/data/stats/_utils/admin-stats-cache";
import { prisma } from "@zoonk/db";

export const countSubscribersByPlan = cache(async () => {
  const results = await prisma.subscription.groupBy({
    _count: { plan: true },
    by: ["plan"],
    where: { status: "active" },
  });

  return results.map((row) => ({ count: row._count.plan, plan: row.plan }));
});

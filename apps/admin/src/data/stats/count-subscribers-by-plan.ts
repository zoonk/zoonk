import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

export const countSubscribersByPlan = cacheAdminData(async () => {
  const results = await prisma.subscription.groupBy({
    _count: { plan: true },
    by: ["plan"],
    where: { status: "active" },
  });

  return results.map((row) => ({ count: row._count.plan, plan: row.plan }));
});

import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export const countSubscribersByPlan = cache(async () => {
  const results = await prisma.subscription.groupBy({
    _count: { plan: true },
    by: ["plan"],
    where: { status: "active" },
  });

  return results.map((row) => ({ count: row._count.plan, plan: row.plan }));
});

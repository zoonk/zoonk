import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export const getConversionRate = cache(async () => {
  const [paid, total] = await Promise.all([
    prisma.subscription.count({ where: { plan: { not: "free" }, status: "active" } }),
    prisma.user.count(),
  ]);

  const rate = total === 0 ? 0 : (paid / total) * 100;

  return { paid, rate, total };
});

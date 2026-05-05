import "server-only";
import { adminStatsCache as cache } from "@/data/stats/_utils/admin-stats-cache";
import { prisma } from "@zoonk/db";

export const getNewSignups = cache(async (start: Date, end: Date) =>
  prisma.user.count({ where: { createdAt: { gte: start, lte: end } } }),
);

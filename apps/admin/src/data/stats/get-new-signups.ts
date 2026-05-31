import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

export const getNewSignups = cacheAdminData(async (start: Date, end: Date) =>
  prisma.user.count({ where: { createdAt: { gte: start, lte: end } } }),
);

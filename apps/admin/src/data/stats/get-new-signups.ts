import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserWhere } from "@/data/stats/_utils/analytics-user-filter";
import { prisma } from "@zoonk/db";

export const getNewSignups = cacheAdminData(async (start: Date, end: Date) =>
  prisma.user.count({
    where: { ...trackedAnalyticsUserWhere, createdAt: { gte: start, lte: end } },
  }),
);

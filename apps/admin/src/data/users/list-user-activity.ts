import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

/** A learner's days with study in them, from `since`, oldest first. */
export const listUserActivity = cacheAdminData((userId: string, since: Date) =>
  prisma.dailyProgress.findMany({
    orderBy: { date: "asc" },
    select: { brainPowerEarned: true, date: true, lessonsCompleted: true, timeSpentSeconds: true },
    where: { date: { gte: since }, userId },
  }),
);

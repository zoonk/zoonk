import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

export const getUserLearningProfile = cacheAdminData(async (userId: string) =>
  prisma.userLearningProfile.findUnique({
    include: { activeGoal: { select: { id: true, title: true } } },
    where: { userId },
  }),
);

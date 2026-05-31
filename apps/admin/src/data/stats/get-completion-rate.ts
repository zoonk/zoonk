import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

export const getCompletionRate = cacheAdminData(async () => {
  const [started, completed] = await Promise.all([
    prisma.lessonProgress.count(),
    prisma.lessonProgress.count({ where: { completedAt: { not: null } } }),
  ]);

  return started === 0 ? 0 : (completed / started) * 100;
});

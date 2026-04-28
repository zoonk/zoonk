import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export const getCompletionRate = cache(async () => {
  const [started, completed] = await Promise.all([
    prisma.lessonProgress.count(),
    prisma.lessonProgress.count({ where: { completedAt: { not: null } } }),
  ]);

  return started === 0 ? 0 : (completed / started) * 100;
});

import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export const getAvgLessonTime = cache(async () => {
  const result = await prisma.lessonProgress.aggregate({
    _avg: { durationSeconds: true },
    where: { durationSeconds: { not: null } },
  });

  return result._avg.durationSeconds ?? 0;
});

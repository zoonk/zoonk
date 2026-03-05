import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export const getAccuracyRate = cache(async () => {
  const [total, correct] = await Promise.all([
    prisma.stepAttempt.count(),
    prisma.stepAttempt.count({ where: { isCorrect: true } }),
  ]);

  return total === 0 ? 0 : (correct / total) * 100;
});

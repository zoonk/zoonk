import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import {
  type AnswerSumsRow,
  getAnswerAccuracy,
  getAnswersSql,
} from "@/data/stats/_utils/answer-accuracy";
import { prisma } from "@zoonk/db";

/**
 * Correct answers over all answers, all time for the dashboard card or within a stats period
 * when dates are given.
 */
export const getAccuracyRate = cacheAdminData(async (start?: Date, end?: Date) => {
  const [sums] = await prisma.$queryRaw<[AnswerSumsRow]>`
    SELECT SUM(answers.correct) AS correct, SUM(answers.incorrect) AS incorrect
    FROM (${getAnswersSql({ end, start })}) answers
  `;

  return getAnswerAccuracy(sums);
});

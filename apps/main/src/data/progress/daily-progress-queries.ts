import "server-only";
import { getUserProgressCacheTag } from "@/data/cache-tags";
import { getSession } from "@/data/users/get-session";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";

export type DailyProgressHistoryRow = {
  brainPowerEarned: number;
  correctAnswers: number;
  date: Date;
  energyAtEnd: number;
  incorrectAnswers: number;
};

type DailyProgressDateRangeInput = { endDate: Date; startDate: Date };

type EarlierDailyProgressInput = { answersOnly: boolean; beforeDate: Date };

/** Keeps only the progress fields shared by the history views. */
function toDailyProgressHistoryRow(row: DailyProgressHistoryRow): DailyProgressHistoryRow {
  return {
    brainPowerEarned: row.brainPowerEarned,
    correctAnswers: row.correctAnswers,
    date: row.date,
    energyAtEnd: row.energyAtEnd,
    incorrectAnswers: row.incorrectAnswers,
  };
}

async function findDailyProgressRows({
  endDate,
  startDate,
  userId,
}: DailyProgressDateRangeInput & { userId: string }): Promise<DailyProgressHistoryRow[]> {
  "use cache";

  cacheTag(getUserProgressCacheTag(userId));

  const rows = await prisma.dailyProgress.findMany({
    orderBy: { date: "asc" },
    where: { date: { gte: startDate, lte: endDate }, userId },
  });

  return rows.map((row) => toDailyProgressHistoryRow(row));
}

/** Returns the authenticated learner's progress rows for a date range. */
export async function listDailyProgressRows(
  input: DailyProgressDateRangeInput,
): Promise<DailyProgressHistoryRow[]> {
  const session = await getSession();
  return session ? findDailyProgressRows({ ...input, userId: session.user.id }) : [];
}

/** Builds the optional answer predicate used by Score history navigation. */
function getEarlierProgressAnswerWhere(answersOnly: boolean) {
  if (!answersOnly) {
    return {};
  }

  return { OR: [{ correctAnswers: { gt: 0 } }, { incorrectAnswers: { gt: 0 } }] };
}

async function findEarlierDailyProgress({
  answersOnly,
  beforeDate,
  userId,
}: EarlierDailyProgressInput & { userId: string }): Promise<boolean> {
  "use cache";

  cacheTag(getUserProgressCacheTag(userId));

  const row = await prisma.dailyProgress.findFirst({
    where: { ...getEarlierProgressAnswerWhere(answersOnly), date: { lt: beforeDate }, userId },
  });

  return Boolean(row);
}

/** Checks whether the authenticated learner has relevant progress before a date. */
export async function hasEarlierDailyProgress(input: EarlierDailyProgressInput): Promise<boolean> {
  const session = await getSession();
  return session ? findEarlierDailyProgress({ ...input, userId: session.user.id }) : false;
}

import "server-only";
import { getUserProgressCacheTag } from "@/data/cache-tags";
import { getSession } from "@/data/users/get-session";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getProgressDateFilter } from "./_utils/progress-date-filter";

type HighestBpDayData = { brainPower: number; date: Date };

type LevelInsightsData = { highestBpDay: HighestBpDayData };

type LevelInsightsParams = { endDate?: Date; startDate?: Date };

/**
 * Level owns the strongest Brain Power day, while general learning totals live
 * on Activity. Returning null for periods without earned BP keeps Level from
 * rendering an empty insight section for decay-only progress rows.
 */
function buildLevelInsights(
  highestBpDay: { brainPowerEarned: number; date: Date } | null,
): LevelInsightsData | null {
  return highestBpDay
    ? { highestBpDay: { brainPower: highestBpDay.brainPowerEarned, date: highestBpDay.date } }
    : null;
}

/** Loads the strongest Brain Power day in the requested period. */
async function findLevelInsights({
  endDate,
  startDate,
  userId,
}: LevelInsightsParams & { userId: string }): Promise<LevelInsightsData | null> {
  "use cache";

  cacheTag(getUserProgressCacheTag(userId));

  const dateFilter = getProgressDateFilter({ endDate, startDate });

  const highestBpDay = await prisma.dailyProgress.findFirst({
    orderBy: [{ brainPowerEarned: "desc" }, { date: "desc" }],
    where: { brainPowerEarned: { gt: 0 }, date: dateFilter, userId },
  });

  return buildLevelInsights(highestBpDay);
}

/**
 * The strongest-day insight shares the selected period with the Brain Power
 * chart. The optional params keep the helper usable for rolling summaries too.
 */
export async function getLevelInsights(
  params: LevelInsightsParams = {},
): Promise<LevelInsightsData | null> {
  const session = await getSession();
  return session ? findLevelInsights({ ...params, userId: session.user.id }) : null;
}

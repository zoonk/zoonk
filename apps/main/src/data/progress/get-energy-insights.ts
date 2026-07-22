import "server-only";
import { getUserProgressCacheTag } from "@/data/cache-tags";
import { getSession } from "@/data/users/get-session";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getProgressDateFilter } from "./_utils/progress-date-filter";

type HighestEnergyDayData = { date: Date; energy: number };
type EnergyInsightsData = { fullEnergyDays: number; highestEnergyDay: HighestEnergyDayData };

type EnergyInsightsParams = { endDate?: Date; startDate?: Date };

/**
 * The page needs compact card data, not raw DailyProgress rows. Returning null
 * only when no period row exists keeps a zero full-energy count visible for
 * learners who had progress but did not reach 100%.
 */
function buildEnergyInsights({
  fullEnergyDays,
  highestEnergyDay,
}: {
  fullEnergyDays: number;
  highestEnergyDay: { date: Date; energyAtEnd: number } | null;
}): EnergyInsightsData | null {
  if (!highestEnergyDay) {
    return null;
  }

  return {
    fullEnergyDays,
    highestEnergyDay: { date: highestEnergyDay.date, energy: highestEnergyDay.energyAtEnd },
  };
}

async function findEnergyInsights({
  endDate,
  startDate,
  userId,
}: EnergyInsightsParams & { userId: string }): Promise<EnergyInsightsData | null> {
  "use cache";

  cacheTag(getUserProgressCacheTag(userId));

  const dateFilter = getProgressDateFilter({ endDate, startDate });

  const [highestEnergyDay, fullEnergyDays] = await Promise.all([
    prisma.dailyProgress.findFirst({
      orderBy: [{ energyAtEnd: "desc" }, { date: "desc" }],
      where: { date: dateFilter, userId },
    }),
    prisma.dailyProgress.count({ where: { date: dateFilter, energyAtEnd: { gte: 100 }, userId } }),
  ]);

  return buildEnergyInsights({ fullEnergyDays, highestEnergyDay });
}

/**
 * Energy insight cards share the score-page date contract: callers may provide
 * an explicit history window, otherwise the query uses the default lookback.
 */
export async function getEnergyInsights(
  params: EnergyInsightsParams = {},
): Promise<EnergyInsightsData | null> {
  const session = await getSession();
  return session ? findEnergyInsights({ ...params, userId: session.user.id }) : null;
}

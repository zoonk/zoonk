import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { cache } from "react";
import { getProgressDateFilter } from "./_utils/progress-date-filter";

type HighestEnergyDayData = { date: Date; energy: number };
type EnergyInsightsData = { fullEnergyDays: number; highestEnergyDay: HighestEnergyDayData };

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

const cachedGetEnergyInsights = cache(
  async (
    startDateIso?: string,
    endDateIso?: string,
    headers?: Headers,
  ): Promise<EnergyInsightsData | null> => {
    const session = await getSession(headers);

    if (!session) {
      return null;
    }

    const userId = session.user.id;
    const dateFilter = getProgressDateFilter({ endDateIso, startDateIso });

    const [highestEnergyDay, fullEnergyDays] = await Promise.all([
      prisma.dailyProgress.findFirst({
        orderBy: [{ energyAtEnd: "desc" }, { date: "desc" }],
        where: { date: dateFilter, userId },
      }),
      prisma.dailyProgress.count({
        where: { date: dateFilter, energyAtEnd: { gte: 100 }, userId },
      }),
    ]);

    return buildEnergyInsights({ fullEnergyDays, highestEnergyDay });
  },
);

/**
 * Energy insight cards share the score-page date contract: callers may provide
 * an explicit history window, otherwise the query uses the default recent
 * lookback used by progress summaries.
 */
export function getEnergyInsights(params?: {
  endDate?: Date;
  headers?: Headers;
  startDate?: Date;
}): Promise<EnergyInsightsData | null> {
  return cachedGetEnergyInsights(
    params?.startDate?.toISOString(),
    params?.endDate?.toISOString(),
    params?.headers,
  );
}

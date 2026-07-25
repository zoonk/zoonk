import "server-only";
import { getRequestProgressDateContext } from "@/data/_utils/get-request-time-zone";
import { getUserProgressCacheTag } from "@/data/cache-tags";
import { getSession } from "@/data/users/get-session";
import { type EnergyData } from "@zoonk/core/progress/energy";
import { getEnergyData as queryEnergyData } from "@zoonk/core/progress/energy-queries";
import { getContributionCalendarDateRangeFromEndDate } from "@zoonk/utils/contribution-calendar";
import { safeAsync } from "@zoonk/utils/error";
import { cacheTag } from "next/cache";

/**
 * Caches the core read model that combines singleton current Energy with
 * learner-local history and insights under one invalidation tag.
 */
async function findEnergyData({
  endDate,
  startDate,
  timeZone,
  userId,
}: {
  endDate: Date;
  startDate: Date;
  timeZone: string;
  userId: string;
}): Promise<EnergyData | null> {
  "use cache";

  cacheTag(getUserProgressCacheTag(userId));

  return queryEnergyData({ endDate, startDate, timeZone, userId });
}

/**
 * The private request context supplies one server-derived local date so each
 * document computes a stable current value, chart, and lifetime average.
 */
async function getCurrentEnergyDateRange() {
  const { currentDate, timeZone } = await getRequestProgressDateContext();

  return { ...getContributionCalendarDateRangeFromEndDate(currentDate), timeZone };
}

/** Returns the signed-in learner's complete derived Energy page data. */
export async function getEnergyData(): Promise<EnergyData | null> {
  const { data } = await safeAsync(async () => {
    const [dateRange, session] = await Promise.all([getCurrentEnergyDateRange(), getSession()]);

    if (!session) {
      return null;
    }

    return findEnergyData({ ...dateRange, userId: session.user.id });
  });

  return data;
}

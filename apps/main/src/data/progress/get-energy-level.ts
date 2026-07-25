import "server-only";
import { getRequestProgressDateContext } from "@/data/_utils/get-request-time-zone";
import { getUserProgressCacheTag } from "@/data/cache-tags";
import { getSession } from "@/data/users/get-session";
import { type EnergyLevelData } from "@zoonk/core/progress/energy";
import { getEnergyLevel as queryEnergyLevel } from "@zoonk/core/progress/energy-queries";
import { cacheTag } from "next/cache";

/** Caches the reusable Energy query for the current authenticated learner. */
async function findEnergyLevel({
  currentDate,
  timeZone,
  userId,
}: {
  currentDate: Date;
  timeZone: string;
  userId: string;
}): Promise<EnergyLevelData | null> {
  "use cache";

  cacheTag(getUserProgressCacheTag(userId));

  return queryEnergyLevel({ targetDate: currentDate, timeZone, userId });
}

/** Returns the current Energy level for the authenticated learner. */
export async function getEnergyLevel(): Promise<EnergyLevelData | null> {
  const [dateContext, session] = await Promise.all([getRequestProgressDateContext(), getSession()]);

  if (!session) {
    return null;
  }

  return findEnergyLevel({
    currentDate: dateContext.currentDate,
    timeZone: dateContext.timeZone,
    userId: session.user.id,
  });
}

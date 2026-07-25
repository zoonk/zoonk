import "server-only";
import { getRequestTimeZone } from "@/data/_utils/get-request-time-zone";
import { getUserProgressCacheTag } from "@/data/cache-tags";
import { getSession } from "@/data/users/get-session";
import { type PlayerInitialProgress } from "@zoonk/core/player/contracts/progress-snapshot";
import { getPlayerProgressSnapshot as queryPlayerProgressSnapshot } from "@zoonk/core/player/queries/get-progress-snapshot";
import { type ScoreDateRange } from "@zoonk/core/progress/score-date-range";
import { safeAsync } from "@zoonk/utils/error";
import { cacheTag } from "next/cache";
import { resolveScoreDateRange } from "./_utils/resolve-score-date-range";

type PlayerProgressSnapshotParams = { now?: Date };

type PlayerProgressDates = {
  bestDayRange: ScoreDateRange["dailyProgress"];
  timeZone: string;
  today: Date;
};

/**
 * Reuses Score's request-timezone-aware date contract so the player milestone
 * and the Patterns page consider the same 90 learner-local dates.
 */
async function resolvePlayerProgressDates(
  params: PlayerProgressSnapshotParams,
): Promise<PlayerProgressDates> {
  const timeZone = await getRequestTimeZone();
  const range = await resolveScoreDateRange({ ...params, timeZone });

  return { bestDayRange: range.dailyProgress, timeZone, today: range.dailyProgress.endDate };
}

/** Caches the app-agnostic player snapshot for one authenticated learner and date range. */
async function findPlayerProgressSnapshot({
  bestDayRange,
  timeZone,
  today,
  userId,
}: PlayerProgressDates & { userId: string }): Promise<PlayerInitialProgress> {
  "use cache";

  cacheTag(getUserProgressCacheTag(userId));

  return queryPlayerProgressSnapshot({ bestDayRange, timeZone, today, userId });
}

/**
 * Resolves web request context and degrades optional milestone data to null so
 * a transient progress failure never blocks the lesson player itself.
 */
export async function getPlayerProgressSnapshot(
  params: PlayerProgressSnapshotParams = {},
): Promise<PlayerInitialProgress | null> {
  const { data } = await safeAsync(async () => {
    const [session, dates] = await Promise.all([getSession(), resolvePlayerProgressDates(params)]);

    if (!session) {
      return null;
    }

    return findPlayerProgressSnapshot({ ...dates, userId: session.user.id });
  });

  return data;
}

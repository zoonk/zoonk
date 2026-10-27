import "server-only";
import { type DailyProgress, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getUserProgressCacheTag } from "../../cache/tags";

/** Only opt in when the caller already needs lifetime history; detail reads keep their bounds. */
export type ProgressHistoryOptions = { history?: "lifetime" };

/** Authenticated capabilities share the rows already needed for lifetime Energy on Statistics. */
export async function readLifetimeDailyProgress(userId: string) {
  "use cache: private";
  cacheTag(getUserProgressCacheTag(userId));

  return prisma.dailyProgress.findMany({ orderBy: { date: "asc" }, where: { userId } });
}

/** The Score and calendar contracts retain their own inclusive learner-local date bounds. */
export function dailyProgressInWindow({
  endDate,
  rows,
  startDate,
}: {
  endDate: Date;
  rows: DailyProgress[];
  startDate: Date;
}): DailyProgress[] {
  return rows.filter((row) => row.date >= startDate && row.date <= endDate);
}

import "server-only";
import { type DailyProgress, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getUserProgressCacheTag } from "../../cache/tags";

/** Opt into lifetime rows only when already needed; detail reads retain their own date bounds. */
export type ProgressHistoryOptions = { history?: "lifetime" };

/** Internal GET fact; callers must derive userId from authenticated capability access. */
export async function readLifetimeDailyProgress(userId: string) {
  "use cache: private";
  cacheTag(getUserProgressCacheTag(userId));

  return prisma.dailyProgress.findMany({ orderBy: { date: "asc" }, where: { userId } });
}

/** Both learner-local date bounds are inclusive. */
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

import "server-only";
import { getRequestTimeZone } from "@/data/_utils/get-request-time-zone";
import { getUserProgressCacheTag } from "@/data/cache-tags";
import { getSession } from "@/data/users/get-session";
import { hasUserLearningProgress } from "@zoonk/core/progress/user-progress";
import { type UserProgress, prisma } from "@zoonk/db";
import {
  type ContributionCalendarDateRange,
  getContributionCalendarDateKey,
  getContributionCalendarDateRange,
  getContributionCalendarDates,
} from "@zoonk/utils/contribution-calendar";
import { computeDecayedEnergy } from "@zoonk/utils/energy";
import { safeAsync } from "@zoonk/utils/error";
import { cacheTag } from "next/cache";

export type EnergyHistoryDay = { date: Date; energy: number | null };

type EnergyHistoryData = { currentEnergy: number; days: EnergyHistoryDay[] };

type EnergyHistoryRow = Awaited<ReturnType<typeof listEnergyHistoryRows>>[number];

type EnergyHistoryContext = ContributionCalendarDateRange & { now: Date };

type EnergyHistoryDateQuery = ContributionCalendarDateRange & { userId: string };

type EnergyHistoryQueryData = { progress: UserProgress | null; rows: EnergyHistoryRow[] };

/**
 * The Energy calendar needs complete DailyProgress rows so stored zero values
 * remain distinguishable from dates that have no Energy record.
 */
function listEnergyHistoryRows({ endDate, startDate, userId }: EnergyHistoryDateQuery) {
  return prisma.dailyProgress.findMany({
    orderBy: { date: "asc" },
    where: { date: { gte: startDate, lte: endDate }, userId },
  });
}

/**
 * Capturing one approximate timestamp keeps Energy decay and the calendar
 * boundary consistent while allowing tests to provide an exact clock.
 */
async function getCurrentEnergyHistoryContext(timeZone: string): Promise<EnergyHistoryContext> {
  "use cache";

  const now = new Date();
  return { now, ...getContributionCalendarDateRange({ now, timeZone }) };
}

/**
 * Request timezone lookup stays outside the shared cache while its IANA name
 * provides a stable cache argument for Energy decay and the calendar boundary.
 */
async function getCurrentEnergyHistoryRequestContext(): Promise<EnergyHistoryContext> {
  return getCurrentEnergyHistoryContext(await getRequestTimeZone());
}

/**
 * Energy history and the durable current value share one progress cache tag so
 * a lesson completion invalidates the complete page dataset together.
 */
async function findEnergyHistoryQueryData({
  endDate,
  startDate,
  userId,
}: EnergyHistoryDateQuery): Promise<EnergyHistoryQueryData> {
  "use cache";

  cacheTag(getUserProgressCacheTag(userId));

  const [rows, progress] = await Promise.all([
    listEnergyHistoryRows({ endDate, startDate, userId }),
    prisma.userProgress.findUnique({ where: { userId } }),
  ]);

  return { progress, rows };
}

/**
 * A map keeps recorded 0% Energy distinct from an absent date while the full
 * calendar fills dates that predate learning with null.
 */
function buildEnergyByDate(rows: EnergyHistoryRow[]): Map<string, number> {
  return new Map(
    rows.map((row) => [getContributionCalendarDateKey(row.date), row.energyAtEnd] as const),
  );
}

/** Builds one visible Energy square from its date and optional stored value. */
function buildEnergyHistoryDay({
  date,
  energyByDate,
}: {
  date: Date;
  energyByDate: Map<string, number>;
}): EnergyHistoryDay {
  return { date, energy: energyByDate.get(getContributionCalendarDateKey(date)) ?? null };
}

/**
 * The calendar renders the same stable 53-week window as Activity and ends on
 * the current calendar date in the learner's request timezone.
 */
function buildEnergyHistoryDays({
  endDate,
  rows,
  startDate,
}: {
  endDate: Date;
  rows: EnergyHistoryRow[];
  startDate: Date;
}): EnergyHistoryDay[] {
  const energyByDate = buildEnergyByDate(rows);
  const dates = getContributionCalendarDates({ endDate, startDate });

  return dates.map((date) => buildEnergyHistoryDay({ date, energyByDate }));
}

/**
 * Converts cached persistence rows into live Energy. A learner with durable
 * progress keeps the page even when every stored day predates the visible
 * calendar, while a zeroed signup placeholder still receives the empty state.
 */
function buildEnergyHistory({
  endDate,
  now,
  progress,
  rows,
  startDate,
}: {
  endDate: Date;
  now: Date;
  progress: UserProgress | null;
  rows: EnergyHistoryRow[];
  startDate: Date;
}): EnergyHistoryData | null {
  if (rows.length === 0 && !hasUserLearningProgress(progress)) {
    return null;
  }

  return {
    currentEnergy: progress
      ? computeDecayedEnergy(progress.currentEnergy, progress.lastActiveAt, now)
      : 0,
    days: buildEnergyHistoryDays({ endDate, rows, startDate }),
  };
}

/**
 * Returns live current Energy plus the signed-in learner's bounded daily
 * history. Optional request timing keeps boundary tests deterministic.
 */
export async function getEnergyHistory({
  now,
  timeZone,
}: { now?: Date; timeZone?: string } = {}): Promise<EnergyHistoryData | null> {
  const { data } = await safeAsync(async () => {
    const contextPromise = now
      ? Promise.resolve({ now, ...getContributionCalendarDateRange({ now, timeZone }) })
      : getCurrentEnergyHistoryRequestContext();

    const [context, session] = await Promise.all([contextPromise, getSession()]);

    if (!session) {
      return null;
    }

    const queryData = await findEnergyHistoryQueryData({
      endDate: context.endDate,
      startDate: context.startDate,
      userId: session.user.id,
    });

    return buildEnergyHistory({ ...context, ...queryData });
  });

  return data;
}

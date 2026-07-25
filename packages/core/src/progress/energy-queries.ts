import "server-only";
import { prisma } from "@zoonk/db";
import {
  getContributionCalendarDateKey,
  getContributionCalendarDates,
} from "@zoonk/utils/contribution-calendar";
import { projectEnergyTimeline } from "./_utils/energy-timeline";
import {
  type EnergyCursor,
  type EnergyData,
  type EnergyDay,
  type EnergyLevelData,
  MAX_ENERGY,
  projectPersistedEnergy,
} from "./energy";
import { getUserProgress } from "./progress-metrics";
import { hasUserLearningProgress } from "./user-progress";

type EnergyRows = Awaited<ReturnType<typeof listEnergyCursors>>;

/** Loads truthful learner-local Energy history without coupling the query to an app cache. */
function listEnergyCursors({ userId }: { userId: string }) {
  return prisma.dailyProgress.findMany({ orderBy: { date: "asc" }, where: { userId } });
}

/** Maps a sparse projected timeline onto every date in the requested visible range. */
function buildEnergyDays({
  endDate,
  projectedDays,
  startDate,
}: {
  endDate: Date;
  projectedDays: EnergyCursor[];
  startDate: Date;
}): EnergyDay[] {
  const energyByDate = new Map(
    projectedDays.map(
      (day) => [getContributionCalendarDateKey(day.date), day.energyAtEnd] as const,
    ),
  );

  return getContributionCalendarDates({ endDate, startDate }).map((date) => ({
    date,
    energy: energyByDate.get(getContributionCalendarDateKey(date)) ?? null,
  }));
}

/**
 * Synthetic inactive days always decay below their preceding cursor, so only
 * authoritative completion rows can contribute a day at maximum Energy.
 */
function getFullEnergyDays(rows: EnergyRows): number {
  return rows.filter((row) => row.energyAtEnd >= MAX_ENERGY).length;
}

/** Builds the shared Energy history read model from authoritative completion rows. */
function buildEnergyData({
  currentEnergy,
  endDate,
  rows,
  startDate,
}: {
  currentEnergy: number;
  endDate: Date;
  rows: EnergyRows;
  startDate: Date;
}): EnergyData {
  const projection = projectEnergyTimeline({
    cursors: rows,
    targetDate: endDate,
    visibleStartDate: startDate,
  });

  return {
    currentEnergy,
    days: buildEnergyDays({ endDate, projectedDays: projection.visibleDays, startDate }),
    insights:
      projection.averageEnergy === null
        ? null
        : { averageEnergy: projection.averageEnergy, fullEnergyDays: getFullEnergyDays(rows) },
  };
}

/**
 * Returns a complete Energy history for an explicit learner and visible range.
 * Apps remain responsible for authenticating the user and selecting that range.
 */
export async function getEnergyData({
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
  const [rows, progress] = await Promise.all([
    listEnergyCursors({ userId }),
    getUserProgress({ userId }),
  ]);

  if (!hasUserLearningProgress(progress)) {
    return null;
  }

  const projection = projectPersistedEnergy({
    persistedEnergy: progress,
    targetDate: endDate,
    timeZone,
  });

  return buildEnergyData({ currentEnergy: projection.currentEnergy, endDate, rows, startDate });
}

/**
 * Returns current Energy from the learner's singleton persisted state so
 * compact surfaces do not load DailyProgress history.
 */
export async function getEnergyLevel({
  targetDate,
  timeZone,
  userId,
}: {
  targetDate: Date;
  timeZone: string;
  userId: string;
}): Promise<EnergyLevelData | null> {
  const progress = await getUserProgress({ userId });

  if (!hasUserLearningProgress(progress)) {
    return null;
  }

  const projection = projectPersistedEnergy({ persistedEnergy: progress, targetDate, timeZone });

  return { currentEnergy: projection.currentEnergy };
}

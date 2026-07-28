import { prisma } from "@zoonk/db";
import {
  getContributionCalendarDateKey,
  getContributionCalendarDates,
} from "@zoonk/utils/contribution-calendar";
import { projectEnergyTimeline } from "./_utils/energy-timeline";
import { type EnergyCursor, type EnergyData, type EnergyDay, MAX_ENERGY } from "./energy";

type EnergyRows = Awaited<ReturnType<typeof listEnergyCursors>>;

/** Loads truthful learner-local Energy history without coupling the query to an app cache. */
export function listEnergyCursors({ userId }: { userId: string }) {
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
export function buildEnergyData({
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

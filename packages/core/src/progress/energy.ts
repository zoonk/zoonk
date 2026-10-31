import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";

export const DAILY_DECAY = 1;
export const ENERGY_PER_CORRECT = 0.2;
export const ENERGY_PER_INCORRECT = -0.1;
export const ENERGY_PER_STATIC = 0.1;
export const MAX_ENERGY = 100;
export const MIN_ENERGY = 0;

export type EnergyCursor = { date: Date; energyAtEnd: number };

export type EnergyDay = { date: Date; energy: number | null };

type EnergyInsightsData = { averageEnergy: number; fullEnergyDays: number };

export type EnergyData = {
  currentEnergy: number;
  days: EnergyDay[];
  insights: EnergyInsightsData | null;
};

export type EnergyLevelData = { currentEnergy: number };

export type CurrentEnergyProjection = { currentEnergy: number; effectiveDate: Date };

export type PersistedEnergy = { currentEnergy: number; lastActiveAt: Date };

export function clampEnergy(value: number): number {
  return Math.min(MAX_ENERGY, Math.max(MIN_ENERGY, value));
}

/** Future local dates caused by travel must not project backward behind the cursor. */
export function projectCurrentEnergy({
  cursor,
  targetDate,
}: {
  cursor: EnergyCursor | null;
  targetDate: Date;
}): CurrentEnergyProjection {
  const effectiveDate = cursor && cursor.date > targetDate ? cursor.date : targetDate;

  if (!cursor) {
    return { currentEnergy: MIN_ENERGY, effectiveDate };
  }

  const dayDifference = Math.round((effectiveDate.getTime() - cursor.date.getTime()) / MS_PER_DAY);

  const inactiveDayCount = Math.max(0, dayDifference - 1);
  const currentEnergy = clampEnergy(cursor.energyAtEnd - inactiveDayCount * DAILY_DECAY);

  return { currentEnergy, effectiveDate };
}

/** Reinterpret the last completion instant in the current zone; never change its historical stored local date. */
export function projectPersistedEnergy({
  persistedEnergy,
  targetDate,
  timeZone,
}: {
  persistedEnergy: PersistedEnergy;
  targetDate: Date;
  timeZone: string;
}): CurrentEnergyProjection {
  const cursor = {
    date: getDateInTimeZone({ date: persistedEnergy.lastActiveAt, timeZone }),
    energyAtEnd: persistedEnergy.currentEnergy,
  };

  return projectCurrentEnergy({ cursor, targetDate });
}

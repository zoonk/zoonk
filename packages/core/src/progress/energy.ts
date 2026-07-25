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

export type EnergyInsightsData = { averageEnergy: number; fullEnergyDays: number };

export type EnergyData = {
  currentEnergy: number;
  days: EnergyDay[];
  insights: EnergyInsightsData | null;
};

export type EnergyLevelData = { currentEnergy: number };

export type CurrentEnergyProjection = { currentEnergy: number; effectiveDate: Date };

export type PersistedEnergy = { currentEnergy: number; lastActiveAt: Date };

/** Keeps every persisted and previewed Energy value within the product's 0–100 range. */
export function clampEnergy(value: number): number {
  return Math.min(MAX_ENERGY, Math.max(MIN_ENERGY, value));
}

/**
 * Projects a dated Energy value through fully inactive calendar days. Historical
 * timelines can contain a future learner-local date after travel, so the
 * effective date never moves behind the supplied cursor.
 */
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

/**
 * Converts the last completion instant into the caller's current timezone
 * before projecting decay. The instant stays authoritative across travel while
 * daily learning metrics remain attached to each completion's truthful date.
 */
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

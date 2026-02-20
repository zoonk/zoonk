import { DAILY_DECAY, MAX_ENERGY, MIN_ENERGY, MS_PER_DAY } from "./constants";

export function toUTCMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function clampEnergy(value: number): number {
  return Math.min(MAX_ENERGY, Math.max(MIN_ENERGY, value));
}

export function computeDecayedEnergy(currentEnergy: number, lastActiveAt: Date, now: Date): number {
  const lastActiveDate = toUTCMidnight(lastActiveAt);
  const today = toUTCMidnight(now);
  const dayDiff = Math.round((today.getTime() - lastActiveDate.getTime()) / MS_PER_DAY);
  const inactiveDays = Math.max(0, dayDiff - 1);

  return Math.max(MIN_ENERGY, currentEnergy - inactiveDays * DAILY_DECAY);
}

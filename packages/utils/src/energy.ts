import { MS_PER_DAY } from "./date";

export const DAILY_DECAY = 1;
export const ENERGY_PER_CORRECT = 0.2;
export const ENERGY_PER_INCORRECT = -0.1;
export const ENERGY_PER_STATIC = 0.1;
const MAX_ENERGY = 100;
export const MIN_ENERGY = 0;

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

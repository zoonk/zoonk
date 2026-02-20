const MS_PER_DAY = 86_400_000;

export function getDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function computeDecayedEnergy(currentEnergy: number, lastActiveAt: Date, now: Date): number {
  const lastActiveDate = getDateOnly(lastActiveAt);
  const today = getDateOnly(now);
  const dayDiff = Math.round((today.getTime() - lastActiveDate.getTime()) / MS_PER_DAY);
  const inactiveDays = Math.max(0, dayDiff - 1);

  return Math.max(0, currentEnergy - inactiveDays);
}

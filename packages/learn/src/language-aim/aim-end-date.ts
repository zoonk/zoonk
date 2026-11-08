import { MAX_PLAN_DAYS } from "@zoonk/core/plans/target-date-range";

const DAY_MS = 86_400_000;

/**
 * When the learner reaches another aim at the same pace: the plan's finish moved by that aim's
 * share of the hours, so the sheet and the finish line under it never disagree. Null past the
 * days a plan lays out, where the plan would leave lessons out instead of finishing.
 */
export function getAimEndDate({
  current,
  endDate,
  hours,
  today,
}: {
  current: number;
  endDate: string | null;
  hours: number;
  today: string;
}): string | null {
  if (!endDate || current <= 0) {
    return null;
  }

  const from = Date.parse(today);
  const days = Math.round(((Date.parse(endDate) - from) / DAY_MS) * (hours / current));

  return days > MAX_PLAN_DAYS ? null : new Date(from + days * DAY_MS).toISOString().slice(0, 10);
}

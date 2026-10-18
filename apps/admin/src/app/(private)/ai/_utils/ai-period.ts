import { readQueryParam } from "@/lib/query-param";

const QUARTER_DAYS = 90;

export const aiPeriodDays = [7, 30, QUARTER_DAYS] as const;

type AiPeriodDays = (typeof aiPeriodDays)[number];

const DEFAULT_PERIOD_DAYS: AiPeriodDays = 30;

/** The period comes from a hand-editable URL, so anything but a listed period means 30 days. */
export function parseAiPeriodDays(value: string | string[] | undefined): AiPeriodDays {
  const days = Number(readQueryParam(value));
  return aiPeriodDays.find((period) => period === days) ?? DEFAULT_PERIOD_DAYS;
}

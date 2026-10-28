import { type DayListStep } from "@/components/public/day-list";
import { getExtracted } from "next-intl/server";

export const DAY_SWITCH = "landing-day";
export const DAY_STATES = ["studied", "missed"] as const;
export const DEFAULT_DAY = "missed";

export type DayState = (typeof DAY_STATES)[number];

export type TomorrowStep = Omit<DayListStep, "annotation"> & { note?: number };

export type Tomorrow = Record<DayState, TomorrowStep[]>;

export async function getStepDetails() {
  const t = await getExtracted();

  return {
    mistakes: (count: number) =>
      t("{count, plural, one {# mistake} other {# mistakes}}", { count }),
    yesterday: (detail: string) => [detail, t("From yesterday")].join(" · "),
  };
}

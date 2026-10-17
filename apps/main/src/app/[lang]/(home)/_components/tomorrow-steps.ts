import { type DayListStep } from "@/components/public/day-list";
import { getExtracted } from "next-intl/server";

/** Yesterday's two days: studied, or no time. Missing it is the default, the case worth showing. */
export const DAY_SWITCH = "landing-day";
export const DAY_STATES = ["studied", "missed"] as const;
export const DEFAULT_DAY = "missed";

export type DayState = (typeof DAY_STATES)[number];

/** One of tomorrow's blocks, numbered by its caption's place under the window, when it has one. */
export type TomorrowStep = Omit<DayListStep, "annotation"> & { note?: number };

/** Tomorrow's day, as Today lists it, after a studied yesterday and after a missed one. */
export type Tomorrow = Record<DayState, TomorrowStep[]>;

/** The details tomorrow's rows share: one marked as yesterday's, and a count of mistakes. */
export async function getStepDetails() {
  const t = await getExtracted();

  return {
    mistakes: (count: number) =>
      t("{count, plural, one {# mistake} other {# mistakes}}", { count }),
    yesterday: (detail: string) => [detail, t("From yesterday")].join(" · "),
  };
}

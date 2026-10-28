import { getCourseExamDaysByRoute } from "@zoonk/core/catalog/course-exam-days-by-route";
import { addIsoDays, daysBetweenIsoDays, getIsoDay } from "@zoonk/utils/calendar-day";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { logError } from "@zoonk/utils/logger";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { unstable_rethrow } from "next/navigation";
import { lang } from "next/root-params";
import { cache } from "react";

export const EXAMPLE_GOALS = ["exam", "move", "job"] as const;

export type ExampleGoal = (typeof EXAMPLE_GOALS)[number];

export const DEFAULT_EXAMPLE_GOAL: ExampleGoal = "exam";

export const GOAL_SWITCH = "landing-goal";

/** A page never suggests learning the language it's written in, so English pages move to Madrid to speak Spanish. */
export type ExampleSet = {
  exam: "enem" | "sat";
  market: "brazil" | "global";
  move: "london" | "madrid";
};

export async function getExampleSet(): Promise<ExampleSet> {
  const language = await lang();

  return {
    exam: language === "pt" ? "enem" : "sat",
    market: language === "pt" ? "brazil" : "global",
    move: language === "en" ? "madrid" : "london",
  };
}

/** Noon UTC is the same day in every time zone. */
function exampleDay(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00Z`);
}

/** Example dates are written as if this were today and move with the real calendar, so no day shown is already gone. */
const AUTHORED_TODAY = "2026-10-13";

const ENEM_ROUTE = { brandSlug: AI_ORG_SLUG, courseSlug: "enem-pt" };

type ExampleDays = { enemDay: string | null; today: string };

/** Cached so the page stays prerendered; the default cache lifetime works it out again soon after the day changes. */
async function getCachedExampleDays(exam: ExampleSet["exam"]): Promise<ExampleDays> {
  "use cache";

  const found = exam === "enem" ? await getCourseExamDaysByRoute(ENEM_ROUTE) : null;
  const timeZone = found?.timeZone ?? "UTC";

  const today = getIsoDay({ now: new Date(), timeZone });
  return { enemDay: found?.days.find((day) => day > today) ?? null, today };
}

async function getExampleDays(exam: ExampleSet["exam"]): Promise<ExampleDays> {
  try {
    return await getCachedExampleDays(exam);
  } catch (error) {
    // Next's own signals (a prerender's interrupted request) must keep propagating.
    unstable_rethrow(error);
    logError("Landing example days failed", { error });

    return getCachedExampleDays("sat");
  }
}

export type ExampleCalendar = {
  enemDay: Date | null;
  shift: (isoDate: string) => Date;
  today: Date;
  tomorrow: Date;
};

export const getExampleCalendar = cache(async (): Promise<ExampleCalendar> => {
  const set = await getExampleSet();
  const { enemDay, today } = await getExampleDays(set.exam);
  const offset = daysBetweenIsoDays({ from: AUTHORED_TODAY, to: today });

  return {
    enemDay: enemDay ? exampleDay(enemDay) : null,
    shift: (isoDate) => exampleDay(addIsoDays({ day: isoDate, days: offset })),
    today: exampleDay(today),
    tomorrow: exampleDay(addIsoDays({ day: today, days: 1 })),
  };
});

const EXAMPLE_GOAL_DATES = {
  enem: "2026-11-08",
  job: "2027-06-10",
  move: "2027-03-01",
  sat: "2027-03-13",
} as const;

export function daysBetween({ from, to }: { from: Date; to: Date }): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

export function getGoalDate({
  calendar,
  goal,
  set,
}: {
  calendar: ExampleCalendar;
  goal: ExampleGoal;
  set: ExampleSet;
}): Date {
  if (goal === "exam" && set.exam === "enem" && calendar.enemDay) {
    return calendar.enemDay;
  }

  return calendar.shift(EXAMPLE_GOAL_DATES[goal === "exam" ? set.exam : goal]);
}

/** A Brazilian database names its columns in Portuguese. */
export const SQL_NAMES = {
  brazil: { orders: "pedidos", region: "regiao", sales: "vendas" },
  global: { orders: "orders", region: "region", sales: "sales" },
} as const;

import { addIsoDays, daysBetweenIsoDays, getIsoDay } from "@/lib/public/calendar-day";
import { getCourseExamDaysByRoute } from "@zoonk/core/catalog/course-exam-days-by-route";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { logError } from "@zoonk/utils/logger";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { unstable_rethrow } from "next/navigation";
import { lang } from "next/root-params";
import { cache } from "react";

/** The landing's example goals, in the order the hero lists them. The first one shows first. */
export const EXAMPLE_GOALS = ["exam", "move", "job"] as const;

export type ExampleGoal = (typeof EXAMPLE_GOALS)[number];

export const DEFAULT_EXAMPLE_GOAL: ExampleGoal = "exam";

/** The radios that pick the example goal, which the whole page follows. */
export const GOAL_SWITCH = "landing-goal";

/**
 * Which examples a language's page shows, so they're local rather than translated: Brazil's
 * national exam (the ENEM), its regions and its spreadsheets for Portuguese, the SAT elsewhere. A
 * page never suggests learning the language it's written in, so English pages move to Madrid to
 * speak Spanish, and every other page moves to London to speak English, the language most of their
 * visitors are learning.
 */
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

/** A day of the examples, at noon UTC so it's the same day in every time zone. */
function exampleDay(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00Z`);
}

/**
 * The day the examples are written as of, a Tuesday. Every example date is written as if this
 * were today and moves with the real calendar, so the page never shows a day already gone; the
 * examples are labeled as examples.
 */
const AUTHORED_TODAY = "2026-10-13";

/** The ENEM course, whose real next sitting the Portuguese example exam counts to. */
const ENEM_ROUTE = { brandSlug: AI_ORG_SLUG, courseSlug: "enem-pt" };

/** The examples' today and the ENEM's next day, as "YYYY-MM-DD" in the exam's time zone. */
type ExampleDays = { enemDay: string | null; today: string };

/**
 * Today, and for the ENEM examples the exam's next day (in the exam's time zone), cached so the page
 * stays prerendered; the default cache lifetime works it out again soon after the day changes, as
 * the course's countdown.
 */
async function getCachedExampleDays(exam: ExampleSet["exam"]): Promise<ExampleDays> {
  "use cache";

  const found = exam === "enem" ? await getCourseExamDaysByRoute(ENEM_ROUTE) : null;
  const timeZone = found?.timeZone ?? "UTC";

  const today = getIsoDay({ now: new Date(), timeZone });
  return { enemDay: found?.days.find((day) => day > today) ?? null, today };
}

/** The example days; a failed read of the exam's sitting falls back to dates that move with today. */
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

/** The examples' calendar: today, tomorrow, and any example date moved to the real calendar. */
export type ExampleCalendar = {
  /** The ENEM's real next day, when the examples count to it. */
  enemDay: Date | null;
  /** An example date as written, moved by as many days as today is past the day it was written. */
  shift: (isoDate: string) => Date;
  today: Date;
  /** The day after, whose Today the "Every day" stop shows. */
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

/** Each example goal's big day as written: the exam, the move, the date the job goal aims for. */
const EXAMPLE_GOAL_DATES = {
  enem: "2026-11-08",
  job: "2027-06-10",
  move: "2027-03-01",
  sat: "2027-03-13",
} as const;

/** Whole days from `from` to `to`. */
export function daysBetween({ from, to }: { from: Date; to: Date }): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/** The example goal's date, by the language's examples: the ENEM's is its real next day. */
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

/** The example query is code, written as at work; a Brazilian database names its columns in Portuguese. */
export const SQL_NAMES = {
  brazil: { orders: "pedidos", region: "regiao", sales: "vendas" },
  global: { orders: "orders", region: "region", sales: "sales" },
} as const;

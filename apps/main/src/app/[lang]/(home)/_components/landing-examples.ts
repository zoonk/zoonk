import { getCourseExamDaysByRoute } from "@zoonk/core/catalog/course-exam-days-by-route";
import { addIsoDays, daysBetweenIsoDays, getIsoDay } from "@zoonk/utils/calendar-day";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { type SupportedLocale, getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { logError } from "@zoonk/utils/logger";
import { unstable_rethrow } from "next/navigation";
import { lang } from "next/root-params";
import { cache } from "react";
import { type ExamExample, type ExampleSet } from "./example-set";
import { de } from "./example-sets/de";
import { en } from "./example-sets/en";
import { es } from "./example-sets/es";
import { fr } from "./example-sets/fr";
import { it } from "./example-sets/it";
import { ja } from "./example-sets/ja";
import { ko } from "./example-sets/ko";
import { pl } from "./example-sets/pl";
import { pt } from "./example-sets/pt";
import { tr } from "./example-sets/tr";
import { getNextSitting } from "./next-sitting";

export const EXAMPLE_GOALS = ["exam", "move", "job"] as const;

export type ExampleGoal = (typeof EXAMPLE_GOALS)[number];

export const DEFAULT_EXAMPLE_GOAL: ExampleGoal = "exam";

export const GOAL_SWITCH = "landing-goal";

const EXAMPLE_SETS: Record<SupportedLocale, ExampleSet> = {
  de,
  en,
  es,
  fr,
  it,
  ja,
  ko,
  pl,
  pt,
  tr,
};

export async function getExampleSet(): Promise<ExampleSet> {
  return EXAMPLE_SETS[getSupportedLocaleFromLanguage(await lang())];
}

/** Noon UTC is the same day in every time zone. */
function exampleDay(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00Z`);
}

/** Example dates are written as if this were today and move with the real calendar, so no day shown is already gone. */
const AUTHORED_TODAY = "2026-10-13";

type ExamCourse = NonNullable<ExamExample["course"]>;

type ExampleDays = { examDay: string | null; today: string };

/** Cached so the page stays prerendered; the default cache lifetime works it out again soon after the day changes. */
async function getCachedExampleDays(course: ExamCourse | null): Promise<ExampleDays> {
  "use cache";

  const found = course ? await getCourseExamDaysByRoute(course) : null;
  const timeZone = found?.timeZone ?? "UTC";

  const today = getIsoDay({ now: new Date(), timeZone });
  return { examDay: found?.days.find((day) => day > today) ?? null, today };
}

async function getExampleDays(course: ExamCourse | null): Promise<ExampleDays> {
  try {
    return await getCachedExampleDays(course);
  } catch (error) {
    // Next's own signals (a prerender's interrupted request) must keep propagating.
    unstable_rethrow(error);
    logError("Landing example days failed", { error });

    return getCachedExampleDays(null);
  }
}

export type ExampleCalendar = {
  examDay: Date;
  shift: (isoDate: string) => Date;
  today: Date;
  tomorrow: Date;
};

export const getExampleCalendar = cache(async (): Promise<ExampleCalendar> => {
  const { exam } = await getExampleSet();
  const { examDay, today } = await getExampleDays(exam.course ?? null);
  const offset = daysBetweenIsoDays({ from: AUTHORED_TODAY, to: today });

  return {
    examDay: exampleDay(examDay ?? getNextSitting({ day: exam.date, today })),
    shift: (isoDate) => exampleDay(addIsoDays({ day: isoDate, days: offset })),
    today: exampleDay(today),
    tomorrow: exampleDay(addIsoDays({ day: today, days: 1 })),
  };
});

const EXAMPLE_GOAL_DATES = { job: "2027-06-10", move: "2027-03-01" } as const;

export function daysBetween({ from, to }: { from: Date; to: Date }): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

export function getGoalDate({
  calendar,
  goal,
}: {
  calendar: ExampleCalendar;
  goal: ExampleGoal;
}): Date {
  return goal === "exam" ? calendar.examDay : calendar.shift(EXAMPLE_GOAL_DATES[goal]);
}

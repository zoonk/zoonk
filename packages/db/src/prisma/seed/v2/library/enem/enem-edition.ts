import { MS_PER_DAY } from "@zoonk/utils/date";
import { localDay } from "../../_utils/dates";

const SUNDAY = 0;
const NOVEMBER = 10;
const DAYS_PER_WEEK = 7;

const EXAM_TIME_ZONE = "America/Sao_Paulo";

/** Ana's story needs weeks of study ahead: two months leave the planner a few weeks per phase. */
const MIN_DAYS_TO_PLANNED_EXAM = 60;

/** Registration dates of Enem 2026, from its notice (notice No. 64, May 21, 2026). */
const REGISTRATION = { end: "06-12", start: "05-25" } as const;

export type EnemEdition = {
  examDays: readonly [string, string];
  registration: { end: string; start: string };
  timeZone: string;
  year: number;
};

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, "yyyy-mm-dd".length);
}

function nthSundayOfNovember(year: number, nth: number): Date {
  const first = new Date(Date.UTC(year, NOVEMBER, 1));
  const firstSunday = 1 + ((DAYS_PER_WEEK + SUNDAY - first.getUTCDay()) % DAYS_PER_WEEK);

  return new Date(Date.UTC(year, NOVEMBER, firstSunday + (nth - 1) * DAYS_PER_WEEK));
}

function toEdition(year: number): EnemEdition {
  return {
    examDays: [toIsoDate(nthSundayOfNovember(year, 2)), toIsoDate(nthSundayOfNovember(year, 3))],
    registration: { end: `${year}-${REGISTRATION.end}`, start: `${year}-${REGISTRATION.start}` },
    timeZone: EXAM_TIME_ZONE,
    year,
  };
}

function daysToThisYear(now: Date): { daysLeft: number; thisYear: number; today: Date } {
  const today = localDay(now, EXAM_TIME_ZONE);
  const thisYear = today.getUTCFullYear();
  const daysLeft = (nthSundayOfNovember(thisYear, 2).getTime() - today.getTime()) / MS_PER_DAY;

  return { daysLeft, thisYear, today };
}

/**
 * This year's until its second exam day is over in Brasília: a learner who starts in October
 * prepares for the exam weeks away.
 */
export function getEnemEdition(now: Date): EnemEdition {
  const { thisYear, today } = daysToThisYear(now);
  const secondDay = nthSundayOfNovember(thisYear, 3);

  return toEdition(today.getTime() <= secondDay.getTime() ? thisYear : thisYear + 1);
}

/** This year's while its first day is `MIN_DAYS_TO_PLANNED_EXAM` away, so Ana's story fits. */
export function getPlannedEnemEdition(now: Date): EnemEdition {
  const { daysLeft, thisYear } = daysToThisYear(now);

  return toEdition(daysLeft >= MIN_DAYS_TO_PLANNED_EXAM ? thisYear : thisYear + 1);
}

const MONTHS_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

export function formatDatePt(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  return `${date.getUTCDate()} de ${MONTHS_PT[date.getUTCMonth()]} de ${date.getUTCFullYear()}`;
}

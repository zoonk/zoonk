import { MS_PER_DAY } from "@zoonk/utils/date";
import { localDay } from "../../_utils/dates";

const SUNDAY = 0;
const NOVEMBER = 10;
const DAYS_PER_WEEK = 7;

/** Enem runs on Brasília time, so the days left to it count from Brasília's calendar day. */
const EXAM_TIME_ZONE = "America/Sao_Paulo";

/**
 * Ana's goal plans back from the first exam day, and her hand-placed lessons, chapters and mocks
 * (`ana-exam.ts`) only fit inside the phases sized to the days left from 38 days out. Two months
 * leaves a margin and a few weeks for each phase before the final one.
 */
const MIN_DAYS_TO_PLANNED_EXAM = 60;

/** Registration dates of Enem 2026, from its notice (Edital nº 64, May 21, 2026). */
const REGISTRATION = { end: "06-12", start: "05-25" } as const;

export type EnemEdition = {
  /** First and second exam days, as ISO dates. */
  examDays: readonly [string, string];
  registration: { end: string; start: string };
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
    year,
  };
}

/** Days from Brasília's `now` to this year's first exam day (negative once it's past). */
function daysToThisYear(now: Date): { daysLeft: number; thisYear: number; today: Date } {
  const today = localDay(now, EXAM_TIME_ZONE);
  const thisYear = today.getUTCFullYear();
  const daysLeft = (nthSundayOfNovember(thisYear, 2).getTime() - today.getTime()) / MS_PER_DAY;

  return { daysLeft, thisYear, today };
}

/**
 * The Enem edition the stored notice describes on `now`: this year's until its second exam day is
 * over in Brasília, then next year's. Enem 2026 runs on November 8 and 15, the second and third
 * Sundays of November, and the seed projects the same calendar onto other years. A learner who
 * starts an ENEM goal in October prepares for the exam weeks away, so the blueprint names that one
 * (a 2027 notice in October 2026 was 403 days away, and a learner had to correct the year).
 */
export function getEnemEdition(now: Date): EnemEdition {
  const { thisYear, today } = daysToThisYear(now);
  const secondDay = nthSundayOfNovember(thisYear, 3);

  return toEdition(today.getTime() <= secondDay.getTime() ? thisYear : thisYear + 1);
}

/**
 * The Enem edition Ana prepares for (`ana-exam.ts`): this year's while its first exam day is at
 * least `MIN_DAYS_TO_PLANNED_EXAM` days away in Brasília, then next year's, so her hand-placed plan
 * always fits. When it's next year's, her goal is for an edition whose notice isn't out yet, as a
 * learner preparing a year ahead is: her exam's days are estimated from the stored notice's.
 */
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

/** "8 de novembro de 2026", as the notice writes dates. */
export function formatDatePt(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  return `${date.getUTCDate()} de ${MONTHS_PT[date.getUTCMonth()]} de ${date.getUTCFullYear()}`;
}

import { isJsonObject } from "@zoonk/utils/json";
import { type ExamDate, type ExamEdition } from "../../library/exams/blueprint-contract";
import { addDays, daysBetween, fromIsoDate, toIsoDate } from "../../plans/planner/plan-calendar";
import { DAYS_PER_WEEK } from "../../plans/planner/plan-state";

/**
 * The exam days of the edition a learner prepares for, in order. `estimated` days come from
 * another edition's timing because no notice for that edition is stored yet.
 */
export type EditionExamDays = { days: ExamDate[]; estimated: boolean };

const NO_DAYS: EditionExamDays = { days: [], estimated: false };

/**
 * Exam days further apart than this are separate sittings the learner picks from (the SAT's March
 * and May dates); closer ones are one exam spread over several days (ENEM's two Sundays, the
 * Abitur's subjects).
 */
const SITTING_GAP_DAYS = 14;

const YEAR_LENGTH = 4;

function yearOf(isoDate: string): number {
  return Number(isoDate.slice(0, YEAR_LENGTH));
}

function getNoticeExamDays(edition: ExamEdition | null): ExamDate[] {
  return (edition?.dates ?? [])
    .filter((date) => date.kind === "exam")
    .toSorted((first, second) => first.date.localeCompare(second.date));
}

function isSameSitting({ day, previous }: { day: ExamDate; previous: ExamDate | undefined }) {
  return (
    previous !== undefined &&
    daysBetween(fromIsoDate(previous.date), fromIsoDate(day.date)) <= SITTING_GAP_DAYS
  );
}

function addToSittings(sittings: ExamDate[][], day: ExamDate): ExamDate[][] {
  const current = sittings.at(-1) ?? [];

  return isSameSitting({ day, previous: current.at(-1) })
    ? [...sittings.slice(0, -1), [...current, day]]
    : [...sittings, [day]];
}

/**
 * The same weekday in the same week of the same month in another year: the second Sunday of
 * November stays the second Sunday of November. A fifth week the month doesn't have falls back to
 * its last one.
 */
function moveToYear({ date, year }: { date: Date; year: number }): Date {
  const month = date.getUTCMonth();
  const week = Math.ceil(date.getUTCDate() / DAYS_PER_WEEK);
  const monthStartWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const offset = (date.getUTCDay() - monthStartWeekday + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  const day = 1 + offset + (week - 1) * DAYS_PER_WEEK;
  const moved = new Date(Date.UTC(year, month, day));

  return moved.getUTCMonth() === month ? moved : addDays(moved, -DAYS_PER_WEEK);
}

/**
 * A sitting's first day moves to the same week and weekday, and the other days keep their distance
 * from it, so an exam over consecutive days or weekends keeps its shape.
 */
function moveSitting({ sitting, years }: { sitting: ExamDate[]; years: number }): ExamDate[] {
  const [first] = sitting;

  if (!first) {
    return [];
  }

  const start = fromIsoDate(first.date);
  const movedStart = moveToYear({ date: start, year: start.getUTCFullYear() + years });

  return sitting.map((day) => ({
    ...day,
    date: toIsoDate(addDays(movedStart, daysBetween(start, fromIsoDate(day.date)))),
  }));
}

/** The notice's days moved by whole years, with the edition's year in their labels following. */
function estimateEdition({
  days,
  editionYear,
  years,
}: {
  days: ExamDate[];
  editionYear: number;
  years: number;
}): ExamDate[] {
  const noticeYear = String(editionYear);
  const estimatedYear = String(editionYear + years);

  return days
    .reduce<ExamDate[][]>((sittings, day) => addToSittings(sittings, day), [])
    .flatMap((sitting) => moveSitting({ sitting, years }))
    .map((day) => ({ ...day, label: day.label.replaceAll(noticeYear, estimatedYear) }))
    .toSorted((first, second) => first.date.localeCompare(second.date));
}

/** After a past edition, the first edition with a day on or after `from`, estimated. */
function estimateNextEdition({
  days,
  editionYear,
  from,
}: {
  days: ExamDate[];
  editionYear: number;
  from: string;
}): EditionExamDays {
  // Every day is before `from`, so the edition in `from`'s year or the one after has a day ahead.
  const lastYear = yearOf(days.at(-1)?.date ?? from);
  const yearsAhead = Array.from({ length: yearOf(from) - lastYear + 2 }, (_, index) => index + 1);

  const next = yearsAhead
    .map((years) => estimateEdition({ days, editionYear, years }))
    .find((estimated) => estimated.some((day) => day.date >= from));

  return next ? { days: next, estimated: true } : NO_DAYS;
}

/**
 * The exam days a learner prepares for, from the one stored notice of an exam. With a year named,
 * that year's edition: the notice's own days when it's that edition, otherwise the days that year
 * most likely has, from the notice's timing. Without one, the notice's edition while any of its days
 * is on or after `from`, and once they've all passed, the next edition's likely days. Exams without
 * exam days in their notice have none to give.
 */
export function getExamEditionDays({
  edition,
  examYear,
  from,
}: {
  edition: ExamEdition | null;
  /** The year the learner named, such as 2028 in "Enem 2028"; null when they named none. */
  examYear: number | null;
  /** The day the learner starts from, as an ISO date. */
  from: string;
}): EditionExamDays {
  const days = getNoticeExamDays(edition);
  const [first] = days;

  if (!first) {
    return NO_DAYS;
  }

  const editionYear = edition?.year ?? yearOf(first.date);

  if (examYear !== null) {
    return examYear === editionYear
      ? { days, estimated: false }
      : {
          days: estimateEdition({ days, editionYear, years: examYear - editionYear }),
          estimated: true,
        };
  }

  if (days.some((day) => day.date >= from)) {
    return { days, estimated: false };
  }

  return estimateNextEdition({ days, editionYear, from });
}

/** The exam year the learner named, stored in the goal's details; null when they named none. */
export function readExamYear(details: unknown): number | null {
  const year = isJsonObject(details) ? details.examYear : null;
  return typeof year === "number" && Number.isInteger(year) ? year : null;
}

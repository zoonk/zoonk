import { isJsonObject } from "@zoonk/utils/json";
import { type ExamDate, type ExamEdition } from "../../library/exams/blueprint-contract";
import { addDays, daysBetween, fromIsoDate, toIsoDate } from "../../plans/planner/plan-calendar";
import { DAYS_PER_WEEK } from "../../plans/planner/plan-state";
import { groupSittings, markRegistration } from "./exam-sittings";

/**
 * An exam day of the edition a learner prepares for. `registrationClosed`: the notice gives its
 * sitting's last day to register, and that day has passed.
 */
export type EditionExamDay = ExamDate & { registrationClosed: boolean };

/**
 * The exam days of the edition a learner prepares for, in order. `estimated` days come from
 * another edition's timing because no notice for that edition is stored yet.
 */
export type EditionExamDays = { days: EditionExamDay[]; estimated: boolean };

const NO_DAYS: EditionExamDays = { days: [], estimated: false };

const YEAR_LENGTH = 4;

function yearOf(isoDate: string): number {
  return Number(isoDate.slice(0, YEAR_LENGTH));
}

/** The notice's exam days, marked closed for registration once their deadline passed. */
function getNoticeExamDays({
  edition,
  from,
}: {
  edition: ExamEdition | null;
  from: string;
}): EditionExamDay[] {
  const dates = edition?.dates ?? [];

  return markRegistration({
    days: dates.filter((date) => date.kind === "exam"),
    deadlines: dates.filter((date) => date.kind === "registrationEnd").map((date) => date.date),
    from,
  });
}

/**
 * The same weekday in the same week of another month (`month` counts from 0): the second Sunday
 * of November stays the second Sunday, of whatever month and year. A fifth week the month doesn't
 * have falls back to its last one.
 */
function moveToMonth({ date, month, year }: { date: Date; month: number; year: number }): Date {
  const week = Math.ceil(date.getUTCDate() / DAYS_PER_WEEK);
  const monthStartWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const offset = (date.getUTCDay() - monthStartWeekday + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  const day = 1 + offset + (week - 1) * DAYS_PER_WEEK;
  const moved = new Date(Date.UTC(year, month, day));

  return moved.getUTCMonth() === month ? moved : addDays(moved, -DAYS_PER_WEEK);
}

/** The same weekday in the same week of the same month in another year. */
function moveToYear({ date, year }: { date: Date; year: number }): Date {
  return moveToMonth({ date, month: date.getUTCMonth(), year });
}

/**
 * Estimated days moved into the month the learner named ("the exam is in March"), on the same
 * week and weekday, keeping their distance from the first: their month beats the notice's timing,
 * which only tells the likely week and weekday.
 */
function moveIntoMonth<Day extends ExamDate>({
  days,
  month,
}: {
  days: Day[];
  month: number;
}): Day[] {
  const [first] = days;

  if (!first) {
    return days;
  }

  const start = fromIsoDate(first.date);
  const moved = moveToMonth({ date: start, month: month - 1, year: start.getUTCFullYear() });
  const shift = daysBetween(start, moved);

  return days.map((day) => ({ ...day, date: toIsoDate(addDays(fromIsoDate(day.date), shift)) }));
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

/**
 * The notice's days moved by whole years, with the edition's year in their labels following. Its
 * registration deadlines are the notice's edition's, never the estimated one's.
 */
function estimateEdition({
  days,
  editionYear,
  years,
}: {
  days: ExamDate[];
  editionYear: number;
  years: number;
}): EditionExamDay[] {
  const noticeYear = String(editionYear);
  const estimatedYear = String(editionYear + years);

  return groupSittings(days)
    .flatMap((sitting) => moveSitting({ sitting, years }))
    .map((day) => ({
      ...day,
      label: day.label.replaceAll(noticeYear, estimatedYear),
      registrationClosed: false,
    }))
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
 * that year's edition: the notice's own days when it's that edition (its year or its exam's
 * year), otherwise the days that year most likely has, from the notice's timing. Without one, the notice's edition while any of its days
 * is on or after `from`, and once they've all passed, the next edition's likely days. Exams without
 * exam days in their notice have none to give.
 */
export function getExamEditionDays({
  edition,
  examMonth = null,
  examYear,
  from,
  registrationFrom = from,
}: {
  edition: ExamEdition | null;
  /**
   * The month the learner named with the year (1 to 12, "in March 2027"): estimated days move
   * into it, while the notice's official days stay as they are.
   */
  examMonth?: number | null;
  /** The year the learner named, such as 2028 in "Enem 2028"; null when they named none. */
  examYear: number | null;
  /** The day the learner starts from, as an ISO date. */
  from: string;
  /** Registration stays open through its deadline, even when exam eligibility starts tomorrow. */
  registrationFrom?: string;
}): EditionExamDays {
  const found = getEditionDays({ edition, examYear, from, registrationFrom });

  return found.estimated && examMonth !== null && examYear !== null
    ? { days: moveIntoMonth({ days: found.days, month: examMonth }), estimated: true }
    : found;
}

function getEditionDays({
  edition,
  examYear,
  from,
  registrationFrom,
}: {
  edition: ExamEdition | null;
  examYear: number | null;
  from: string;
  registrationFrom: string;
}): EditionExamDays {
  const days = getNoticeExamDays({ edition, from: registrationFrom });
  const [first] = days;

  if (!first) {
    return NO_DAYS;
  }

  const editionYear = edition?.year ?? yearOf(first.date);

  // A notice is often published the year before its exam: the year the learner names is the
  // notice's when it's the notice's own year or the year its exam falls in.
  const isNamedEdition = (year: number) =>
    year === editionYear || days.some((day) => yearOf(day.date) === year);

  if (examYear !== null) {
    return isNamedEdition(examYear)
      ? { days, estimated: false }
      : {
          // Moved from the year its exam falls in, which may be after the notice's.
          days: estimateEdition({ days, editionYear, years: examYear - yearOf(first.date) }),
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

const MONTHS_PER_YEAR = 12;

/** The exam month the learner named (1 to 12), stored in the goal's details; null without one. */
export function readExamMonth(details: unknown): number | null {
  const month = isJsonObject(details) ? details.examMonth : null;

  return typeof month === "number" &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= MONTHS_PER_YEAR
    ? month
    : null;
}

/**
 * The first day of the month the learner named for the exam ("in March 2027"), for a plan no
 * notice gives a day to yet: it counts down to that month's start, so the learner is ready
 * whichever day it turns out to be, and their month wins until a notice sets the day. Null
 * without a named month and year, or once that day isn't after `from`.
 */
export function getNamedMonthStart({
  details,
  from,
}: {
  details: unknown;
  /** The learner's today, as an ISO date. */
  from: string;
}): string | null {
  const month = readExamMonth(details);
  const year = readExamYear(details);

  if (month === null || year === null) {
    return null;
  }

  const start = toIsoDate(new Date(Date.UTC(year, month - 1, 1)));
  return start > from ? start : null;
}

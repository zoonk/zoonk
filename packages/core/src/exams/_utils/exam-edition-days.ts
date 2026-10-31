import { isJsonObject } from "@zoonk/utils/json";
import { type ExamDate, type ExamEdition } from "../../library/exams/blueprint-contract";
import { addDays, daysBetween, fromIsoDate, toIsoDate } from "../../plans/planner/plan-calendar";
import { DAYS_PER_WEEK } from "../../plans/planner/plan-state";
import { groupSittings, markRegistration } from "./exam-sittings";

export type EditionExamDay = ExamDate & { registrationClosed: boolean };

export type EditionExamDays = { days: EditionExamDay[]; estimated: boolean };

const NO_DAYS: EditionExamDays = { days: [], estimated: false };

const YEAR_LENGTH = 4;

function yearOf(isoDate: string): number {
  return Number(isoDate.slice(0, YEAR_LENGTH));
}

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

function moveToMonth({ date, month, year }: { date: Date; month: number; year: number }): Date {
  const week = Math.ceil(date.getUTCDate() / DAYS_PER_WEEK);
  const monthStartWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const offset = (date.getUTCDay() - monthStartWeekday + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  const day = 1 + offset + (week - 1) * DAYS_PER_WEEK;
  const moved = new Date(Date.UTC(year, month, day));

  return moved.getUTCMonth() === month ? moved : addDays(moved, -DAYS_PER_WEEK);
}

function moveToYear({ date, year }: { date: Date; year: number }): Date {
  return moveToMonth({ date, month: date.getUTCMonth(), year });
}

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

function estimateNextEdition({
  days,
  editionYear,
  from,
}: {
  days: ExamDate[];
  editionYear: number;
  from: string;
}): EditionExamDays {
  const lastYear = yearOf(days.at(-1)?.date ?? from);
  const yearsAhead = Array.from({ length: yearOf(from) - lastYear + 2 }, (_, index) => index + 1);

  const next = yearsAhead
    .map((years) => estimateEdition({ days, editionYear, years }))
    .find((estimated) => estimated.some((day) => day.date >= from));

  return next ? { days: next, estimated: true } : NO_DAYS;
}

export function getExamEditionDays({
  edition,
  examMonth = null,
  examYear,
  from,
  registrationFrom = from,
}: {
  edition: ExamEdition | null;
  examMonth?: number | null;
  examYear: number | null;
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

  const isNamedEdition = (year: number) =>
    year === editionYear || days.some((day) => yearOf(day.date) === year);

  if (examYear !== null) {
    return isNamedEdition(examYear)
      ? { days, estimated: false }
      : {
          days: estimateEdition({ days, editionYear, years: examYear - yearOf(first.date) }),
          estimated: true,
        };
  }

  if (days.some((day) => day.date >= from)) {
    return { days, estimated: false };
  }

  return estimateNextEdition({ days, editionYear, from });
}

export function readExamYear(details: unknown): number | null {
  const year = isJsonObject(details) ? details.examYear : null;
  return typeof year === "number" && Number.isInteger(year) ? year : null;
}

const MONTHS_PER_YEAR = 12;

export function readExamMonth(details: unknown): number | null {
  const month = isJsonObject(details) ? details.examMonth : null;

  return typeof month === "number" &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= MONTHS_PER_YEAR
    ? month
    : null;
}

export function getNamedMonthStart({
  details,
  from,
}: {
  details: unknown;
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

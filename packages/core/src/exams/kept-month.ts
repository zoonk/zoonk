import { isJsonObject } from "@zoonk/utils/json";
import { getNamedMonthStart } from "./_utils/exam-edition-days";
import { findLearnerSitting } from "./_utils/exam-sittings";

export { getNamedMonthStart } from "./_utils/exam-edition-days";
export { findLearnerSitting, hasSeveralSittings, listOpenSittings } from "./_utils/exam-sittings";

const MONTH_LENGTH = "YYYY-MM".length;

export function getKeptMonthStart({
  details,
  noticeDay,
  today,
}: {
  details: unknown;
  noticeDay: string | null;
  today: string;
}): string | null {
  const named = getNamedMonthStart({ details, from: today });

  return named && noticeDay && named.slice(0, MONTH_LENGTH) !== noticeDay.slice(0, MONTH_LENGTH)
    ? named
    : null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

export function readOfferedNoticeDay(details: unknown): string | null {
  const day = isJsonObject(details) ? details.offeredNoticeDay : null;
  return typeof day === "string" && ISO_DATE.test(day) ? day : null;
}

export function findMeantExamDays<Day extends { date: string }>({
  days,
  details,
  from,
  goalDate,
}: {
  days: readonly Day[];
  details: unknown;
  from: string;
  goalDate: string | null;
}): Day[] {
  const wanted =
    goalDate !== null && goalDate >= from ? goalDate : getNamedMonthStart({ details, from });

  const sitting = findLearnerSitting({ days, from, goalDate: wanted });

  return (sitting ?? [])
    .filter((day) => day.date >= from)
    .toSorted((first, second) => first.date.localeCompare(second.date));
}

export function findMeantExamDay<Day extends { date: string }>(
  input: Parameters<typeof findMeantExamDays<Day>>[0],
): Day | null {
  return findMeantExamDays(input)[0] ?? null;
}

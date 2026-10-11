import { isJsonObject } from "@zoonk/utils/json";
import { getNamedMonthStart } from "./_utils/exam-edition-days";
import { findLearnerSitting } from "./_utils/exam-sittings";

export { getNamedMonthStart } from "./_utils/exam-edition-days";
export { findLearnerSitting, hasSeveralSittings, listOpenSittings } from "./_utils/exam-sittings";

const MONTH_LENGTH = "YYYY-MM".length;

/**
 * The month the learner named for the exam ("in March 2027") when the notice puts its next day
 * in another month: its first day, which the plan counts down to while the notice's day waits on
 * Today for their answer, since they may mean another sitting. Every screen that shows the exam's
 * date before the plan exists says this, as the plan then does. Null when the notice's day is in
 * their month, or they named no month and year (or that month has begun).
 */
export function getKeptMonthStart({
  details,
  noticeDay,
  today,
}: {
  details: unknown;
  /** The exam's next day in its notice, as an ISO date; null without one. */
  noticeDay: string | null;
  /** The learner's today, as an ISO date. */
  today: string;
}): string | null {
  const named = getNamedMonthStart({ details, from: today });

  return named && noticeDay && named.slice(0, MONTH_LENGTH) !== noticeDay.slice(0, MONTH_LENGTH)
    ? named
    : null;
}

/** "2027-01-10". */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

/**
 * The notice's day the understanding card offered next to the month the learner named ("Use this
 * date"), stored on the goal: confirming the card without it keeps their month over that day, an
 * answer Today doesn't ask for again (see `proposeNoticeChange`). Null when none was offered.
 */
export function readOfferedNoticeDay(details: unknown): string | null {
  const day = isJsonObject(details) ? details.offeredNoticeDay : null;
  return typeof day === "string" && ISO_DATE.test(day) ? day : null;
}

/**
 * The first day, on or after `from`, of the sitting the learner means among an exam's days (see
 * `findLearnerSitting`): the sitting of their own date while it's ahead, else of the month they
 * named, else the next one. An exam held several times a year has none when their month has no
 * sitting, so no screen offers a date in a month they didn't choose.
 */
export function findMeantExamDay<Day extends { date: string }>({
  days,
  details,
  from,
  goalDate,
}: {
  days: readonly Day[];
  /** The goal's details, which hold the month the learner named. */
  details: unknown;
  /** The first day the exam may still be on, as an ISO date. */
  from: string;
  /** The learner's own date, as an ISO date; null when they gave none. */
  goalDate: string | null;
}): Day | null {
  const wanted =
    goalDate !== null && goalDate >= from ? goalDate : getNamedMonthStart({ details, from });

  const sitting = findLearnerSitting({ days, from, goalDate: wanted });
  return sitting?.find((day) => day.date >= from) ?? null;
}

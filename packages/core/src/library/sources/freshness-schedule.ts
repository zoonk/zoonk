import { MS_PER_DAY } from "@zoonk/utils/date";
import { addDays } from "../../plans/planner/plan-calendar";
import { type SourceTopic } from "./source-contract";

const FINAL_STRETCH_DAYS = 14;
const WEEK_DAYS = 7;
const REGULATION_VALID_DAYS = 30;
const SOFTWARE_VALID_DAYS = 90;
const SYLLABUS_VALID_DAYS = 365;

/**
 * An exam notice stays valid until the exam once its blueprint gives the date; until then it's
 * checked a month at a time like a law.
 */
const VALID_DAYS: Record<SourceTopic, number> = {
  exam: REGULATION_VALID_DAYS,
  regulation: REGULATION_VALID_DAYS,
  software: SOFTWARE_VALID_DAYS,
  syllabus: SYLLABUS_VALID_DAYS,
};

type ExamDates = {
  /** The last exam day. The exam has passed once that whole day is over. */
  examDate: Date | null;
  registrationEndsAt: Date | null;
  registrationStartsAt: Date | null;
};

export type FreshnessSchedule =
  | { nextCheckAt: Date; stop: null }
  | { nextCheckAt: null; stop: "examPassed" };

function isRegistrationOpen({ now, dates }: { now: Date; dates: ExamDates }): boolean {
  const { registrationEndsAt, registrationStartsAt } = dates;

  if (!registrationEndsAt || registrationEndsAt < now) {
    return false;
  }

  return !registrationStartsAt || registrationStartsAt <= now;
}

function isFinalStretch({ now, examDate }: { now: Date; examDate: Date | null }): boolean {
  return examDate !== null && examDate.getTime() - now.getTime() <= FINAL_STRETCH_DAYS * MS_PER_DAY;
}

/**
 * A weekly check still wakes up on the day registration opens or the final
 * stretch starts, so the switch to daily checks is never late by a week.
 */
function getWeeklyCheck({ now, dates }: { now: Date; dates: ExamDates }): Date {
  const candidates = [
    addDays(now, WEEK_DAYS),
    dates.registrationStartsAt,
    dates.examDate ? addDays(dates.examDate, -FINAL_STRETCH_DAYS) : null,
  ].filter((date): date is Date => date !== null && date > now);

  return new Date(Math.min(...candidates.map((date) => date.getTime())));
}

/**
 * When an exam's source is checked next: daily while registration is open and
 * in the last 14 days, weekly otherwise, and never after the exam. Notices get
 * corrected often, and a check is only a fetch and a hash compare.
 */
export function getNextExamCheck({
  dates,
  now,
}: {
  dates: ExamDates;
  now: Date;
}): FreshnessSchedule {
  if (dates.examDate && addDays(dates.examDate, 1) <= now) {
    return { nextCheckAt: null, stop: "examPassed" };
  }

  if (isRegistrationOpen({ dates, now }) || isFinalStretch({ examDate: dates.examDate, now })) {
    return { nextCheckAt: addDays(now, 1), stop: null };
  }

  return { nextCheckAt: getWeeklyCheck({ dates, now }), stop: null };
}

/** A source that isn't an exam notice is checked again when it stops being valid. */
export function getNextSourceCheck({
  now,
  validUntil,
}: {
  now: Date;
  validUntil: Date | null;
}): Date {
  if (!validUntil) {
    return addDays(now, WEEK_DAYS);
  }

  return validUntil > now ? validUntil : addDays(now, 1);
}

/** Laws and taxes stay valid 30 days, software 90 days and reference syllabi a year. */
export function getSourceValidUntil({
  fetchedAt,
  topic,
}: {
  fetchedAt: Date;
  topic: SourceTopic;
}): Date {
  return addDays(fetchedAt, VALID_DAYS[topic]);
}

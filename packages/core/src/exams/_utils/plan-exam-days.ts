import { getDateInTimeZone, isValidTimeZone } from "@zoonk/utils/time-zone";
import { examEditionSchema } from "../../library/exams/blueprint-contract";
import { addDays, fromIsoDate, toIsoDate } from "../../plans/planner/plan-calendar";
import { findMeantExamDays } from "../kept-month";
import {
  type EditionExamDays,
  getExamEditionDays,
  readExamMonth,
  readExamYear,
} from "./exam-edition-days";

/** Unknown or invalid notice zones keep the UTC convention used before zones were stored. */
export function getExamCalendarDay({ edition, now }: { edition: unknown; now: Date }): {
  today: string;
  timeZone: string;
} {
  const storedTimeZone = examEditionSchema.safeParse(edition).data?.timeZone;
  const timeZone = storedTimeZone && isValidTimeZone(storedTimeZone) ? storedTimeZone : "UTC";

  return { timeZone, today: toIsoDate(getDateInTimeZone({ date: now, timeZone })) };
}

/**
 * The upcoming days the plan's default targets, including the next open sitting and estimated
 * editions. The course page and a course start share the exam-zone day cutoff; today is already too late.
 */
export function getPlanExamDays({
  edition,
  details,
  goalDate,
  today,
}: {
  edition: unknown;
  details: unknown;
  goalDate: string | null;
  /** Today's calendar date in the exam's zone, from getExamCalendarDay. */
  today: string;
}): EditionExamDays {
  const from = toIsoDate(addDays(fromIsoDate(today), 1));

  const found = getExamEditionDays({
    edition: examEditionSchema.safeParse(edition).data ?? null,
    examMonth: readExamMonth(details),
    examYear: readExamYear(details),
    from,
    registrationFrom: today,
  });

  return {
    days: findMeantExamDays({ days: found.days, details, from, goalDate }),
    estimated: found.estimated,
  };
}

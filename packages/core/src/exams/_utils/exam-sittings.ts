import { addDays, daysBetween, fromIsoDate, toIsoDate } from "../../plans/planner/plan-calendar";

/**
 * Exam days further apart than this are separate sittings the learner picks from (the SAT's March
 * and May dates); closer ones are one exam spread over several days (ENEM's two Sundays, the
 * Abitur's subjects).
 */
const SITTING_GAP_DAYS = 14;

/**
 * An exam day as any screen holds it: the notice's, or one shown on the understanding card, with
 * whether its sitting's registration closed when the notice says so.
 */
type DatedDay = { date: string; registrationClosed?: boolean };

function isSameSitting({ day, previous }: { day: DatedDay; previous: DatedDay | undefined }) {
  return (
    previous !== undefined &&
    daysBetween(fromIsoDate(previous.date), fromIsoDate(day.date)) <= SITTING_GAP_DAYS
  );
}

function addToSittings<Day extends DatedDay>(sittings: Day[][], day: Day): Day[][] {
  const current = sittings.at(-1) ?? [];

  return isSameSitting({ day, previous: current.at(-1) })
    ? [...sittings.slice(0, -1), [...current, day]]
    : [...sittings, [day]];
}

/** An exam's days in sittings (see `SITTING_GAP_DAYS`), in date order. */
export function groupSittings<Day extends DatedDay>(days: readonly Day[]): Day[][] {
  return days
    .toSorted((first, second) => first.date.localeCompare(second.date))
    .reduce<Day[][]>((sittings, day) => addToSittings(sittings, day), []);
}

/**
 * Which sitting each of the notice's registration deadlines is for: the first sitting after it
 * that has none yet, since a deadline can fall after an earlier sitting (DELE's May deadline comes
 * after its April exam). Keyed by the sitting's place in `sittings`.
 */
function pairDeadlines({
  deadlines,
  sittings,
}: {
  deadlines: readonly string[];
  sittings: readonly DatedDay[][];
}): Map<number, string> {
  const pairs = new Map<number, string>();

  for (const deadline of deadlines.toSorted()) {
    const index = sittings.findIndex(
      (sitting, place) => !pairs.has(place) && (sitting[0]?.date ?? "") > deadline,
    );

    if (index !== -1) {
      pairs.set(index, deadline);
    }
  }

  return pairs;
}

/**
 * An exam's days, each marked closed for registration once its sitting's deadline (among the
 * notice's `deadlines`) is before `from`. A sitting the notice gives no deadline for never is.
 */
export function markRegistration<Day extends DatedDay>({
  days,
  deadlines,
  from,
}: {
  days: readonly Day[];
  deadlines: readonly string[];
  /** The learner's today, as an ISO date. */
  from: string;
}): (Day & { registrationClosed: boolean })[] {
  const sittings = groupSittings(days);
  const pairs = pairDeadlines({ deadlines, sittings });

  return sittings.flatMap((sitting, index) => {
    const deadline = pairs.get(index);
    const registrationClosed = deadline !== undefined && deadline < from;

    return sitting.map((day) => ({ ...day, registrationClosed }));
  });
}

/** Whether an exam's days are more than one sitting (DELE's or the SAT's dates through the year). */
export function hasSeveralSittings(days: readonly DatedDay[]): boolean {
  return groupSittings(days).length > 1;
}

function isOpenSitting(sitting: readonly DatedDay[]): boolean {
  return !sitting.some((day) => day.registrationClosed);
}

/** The sittings with a day on or after `from`, in date order. */
function getSittingsAhead<Day extends DatedDay>({
  days,
  from,
}: {
  days: readonly Day[];
  from: string;
}): Day[][] {
  return groupSittings(days).filter((sitting) => sitting.some((day) => day.date >= from));
}

/**
 * The first day of the next `count` sittings still open for registration, from `from`: the dates
 * a learner without one of their own picks from, for an exam held several times a year.
 */
export function listOpenSittings<Day extends DatedDay>({
  count,
  days,
  from,
}: {
  count: number;
  days: readonly Day[];
  /** The first day a sitting may still be taken on, as an ISO date. */
  from: string;
}): Day[] {
  return getSittingsAhead({ days, from })
    .filter((sitting) => isOpenSitting(sitting))
    .slice(0, count)
    .flatMap((sitting) => sitting.slice(0, 1));
}

/** "2027-02" in "2027-02-10". */
const MONTH_LENGTH = "YYYY-MM".length;

function distanceInDays({ date, to }: { date: string; to: string }): number {
  return Math.abs(daysBetween(fromIsoDate(to), fromIsoDate(date)));
}

/**
 * The sitting a learner prepares for among an exam's days, from the sittings with a day on or
 * after `from`, with every day it has. Without a date of theirs (`goalDate` null), the next one
 * still open for registration, else the next. An exam whose days are one sitting has only that one
 * to mean, whatever date they gave, even once its registration closed (they may be in). With
 * several (DELE's or the SAT's dates through the year), the one in their date's month, the nearest
 * to it when the month has two; none when no sitting falls in that month, since any other would
 * move their exam to a month they didn't choose.
 */
export function findLearnerSitting<Day extends DatedDay>({
  days,
  from,
  goalDate,
}: {
  days: readonly Day[];
  /** The first day a sitting may still be taken on, as an ISO date. */
  from: string;
  /** The date the learner's plan counts down to, as an ISO date. */
  goalDate: string | null;
}): Day[] | null {
  const sittings = groupSittings(days);
  const ahead = getSittingsAhead({ days, from });

  if (sittings.length === 1) {
    return ahead[0] ?? null;
  }

  if (goalDate === null) {
    return ahead.find((sitting) => isOpenSitting(sitting)) ?? ahead[0] ?? null;
  }

  const month = goalDate.slice(0, MONTH_LENGTH);

  const nearest = ahead
    .filter((sitting) => sitting.some((day) => day.date.slice(0, MONTH_LENGTH) === month))
    .map((sitting) => ({
      distance: Math.min(...sitting.map((day) => distanceInDays({ date: day.date, to: goalDate }))),
      sitting,
    }))
    .toSorted((first, second) => first.distance - second.distance)
    .at(0);

  return nearest?.sitting ?? null;
}

/**
 * For a learner whose month has no sitting of an exam held several times a year (see
 * `findLearnerSitting`): the first day of the closest sitting before that month and of the closest
 * after it, from the sittings ahead of `from` still open for registration.
 */
export function findClosestSittings<Day extends DatedDay>({
  days,
  from,
  goalDate,
}: {
  days: readonly Day[];
  /** The first day a sitting may still be taken on, as an ISO date. */
  from: string;
  /** The date the learner's plan counts down to, as an ISO date. */
  goalDate: string;
}): Day[] {
  const month = goalDate.slice(0, MONTH_LENGTH);

  const firstDays = getSittingsAhead({ days, from })
    .filter((sitting) => isOpenSitting(sitting))
    .flatMap((sitting) => sitting.slice(0, 1));

  const before = firstDays.findLast((day) => day.date.slice(0, MONTH_LENGTH) < month);
  const after = firstDays.find((day) => day.date.slice(0, MONTH_LENGTH) > month);

  return [before, after].filter((day) => day !== undefined);
}

/**
 * An estimated sitting moved so its first day is the learner's date, when that date is as close to
 * it as two days of one sitting are: they know their day better than past editions' timing, and
 * the other days keep their distance from it. Null for a date further away, a day of their own.
 */
export function moveSittingToDate<Day extends DatedDay>({
  date,
  sitting,
}: {
  date: string;
  sitting: readonly Day[];
}): Day[] | null {
  const [first] = sitting;

  if (!first) {
    return null;
  }

  const shift = daysBetween(fromIsoDate(first.date), fromIsoDate(date));

  if (Math.abs(shift) > SITTING_GAP_DAYS) {
    return null;
  }

  return sitting.map((day) => ({ ...day, date: toIsoDate(addDays(fromIsoDate(day.date), shift)) }));
}

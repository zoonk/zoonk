import { addDays, daysBetween, fromIsoDate, toIsoDate } from "../../plans/planner/plan-calendar";

const SITTING_GAP_DAYS = 14;

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

export function groupSittings<Day extends DatedDay>(days: readonly Day[]): Day[][] {
  return days
    .toSorted((first, second) => first.date.localeCompare(second.date))
    .reduce<Day[][]>((sittings, day) => addToSittings(sittings, day), []);
}

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

export function markRegistration<Day extends DatedDay>({
  days,
  deadlines,
  from,
}: {
  days: readonly Day[];
  deadlines: readonly string[];
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

export function hasSeveralSittings(days: readonly DatedDay[]): boolean {
  return groupSittings(days).length > 1;
}

function isOpenSitting(sitting: readonly DatedDay[]): boolean {
  return !sitting.some((day) => day.registrationClosed);
}

function getSittingsAhead<Day extends DatedDay>({
  days,
  from,
}: {
  days: readonly Day[];
  from: string;
}): Day[][] {
  return groupSittings(days).filter((sitting) => sitting.some((day) => day.date >= from));
}

export function listOpenSittings<Day extends DatedDay>({
  count,
  days,
  from,
}: {
  count: number;
  days: readonly Day[];
  from: string;
}): Day[] {
  return getSittingsAhead({ days, from })
    .filter((sitting) => isOpenSitting(sitting))
    .slice(0, count)
    .flatMap((sitting) => sitting.slice(0, 1));
}

const MONTH_LENGTH = "YYYY-MM".length;

function distanceInDays({ date, to }: { date: string; to: string }): number {
  return Math.abs(daysBetween(fromIsoDate(to), fromIsoDate(date)));
}

export function findLearnerSitting<Day extends DatedDay>({
  days,
  from,
  goalDate,
}: {
  days: readonly Day[];
  from: string;
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

export function findClosestSittings<Day extends DatedDay>({
  days,
  from,
  goalDate,
}: {
  days: readonly Day[];
  from: string;
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

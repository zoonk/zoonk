import { type ExamBossDays } from "./exam-boss-days";
import { toDayMinutes } from "./interval-study-minutes";
import { findDayMock } from "./mock-day";
import { toIsoDate } from "./plan-calendar";
import { type PlannedItem } from "./plan-items";
import { type DayShape, type PlanDay } from "./schedule-units";

/** The minutes a day's kept time is rounded to (see `getKeptMinutes`). */
const KEPT_PRECISION = 1e-9;

/** Lesson minutes by a lesson's key and then a day (ISO date). */
type LessonDays = ReadonlyMap<string, ReadonlyMap<string, number>>;

/**
 * Each phase challenge still to do, by its day, with the lessons it tests and the lesson minutes
 * each takes on its days from the run's first: a pass's teaching as the pass before laid it out
 * (see `listTestedTeaching`), which funding a mock never takes (see `getKeptMinutes`).
 */
export type TestedTeaching = readonly { date: string; lessons: LessonDays }[];

/**
 * The teaching each challenge still to do tests, as one pass laid it out (`built`), on the days
 * the next pass gives them (`placed`, with what each tests, see `placeExamBosses`): only the days
 * from the run's first, so what past days set aside stays as it was. A challenge the learner played
 * or skipped keeps nothing.
 */
export function listTestedTeaching({
  built,
  placed,
  today,
}: {
  built: { items: readonly PlannedItem[]; lessonRawMinutes: LessonDays };
  placed: ExamBossDays;
  today: Date;
}): TestedTeaching {
  const from = toIsoDate(today);
  const status = new Map(built.items.map((item) => [item.key, item.status]));

  return [...placed]
    .filter(([key]) => (status.get(key) ?? "todo") === "todo")
    .map(([, day]) => ({
      date: day.date,
      lessons: new Map(
        (day.tested ?? []).flatMap((key) => {
          const days = [...(built.lessonRawMinutes.get(key) ?? [])].filter(
            ([date]) => date >= from,
          );

          return days.length > 0 ? [[key, new Map(days)] as const] : [];
        }),
      ),
    }))
    .toSorted((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * The protection a run's challenges give their teaching, as text that doesn't depend on order:
 * each challenge's day, then each lesson it tests with its lesson minutes day by day (rounded as
 * the funding rounds them, see `getKeptMinutes`).
 */
function digestTeaching(tested: TestedTeaching | undefined): string {
  return (tested ?? [])
    .map(({ date, lessons }) =>
      [
        date,
        ...[...lessons]
          .map(([key, days]) =>
            [
              key,
              ...[...days]
                .map(([day, minutes]) => `${day}=${Math.round(minutes / KEPT_PRECISION)}`)
                .toSorted(),
            ].join(","),
          )
          .toSorted(),
      ].join(";"),
    )
    .toSorted()
    .join("|");
}

/** Whether two runs' challenges keep the same teaching from mocks' funding (see `digestTeaching`). */
export function isSameTeaching(first?: TestedTeaching, second?: TestedTeaching): boolean {
  return digestTeaching(first) === digestTeaching(second);
}

/**
 * The challenge a mock's funding window keeps the teaching of: the first still to do dated in it,
 * from its start (`windowStart`) to the mock's own day (`mockDate`). One after the mock keeps
 * nothing of the window: a later challenge never takes an earlier mock's time.
 */
function findWindowChallenge({
  mockDate,
  tested,
  windowStart,
}: {
  mockDate: string;
  tested: TestedTeaching;
  windowStart: string;
}) {
  return tested.find((challenge) => challenge.date >= windowStart && challenge.date <= mockDate);
}

/**
 * The lesson minutes each day from `from` to `to` keeps: the lessons the window's challenge tests
 * on it and the promised lesson's, each lesson counted once on each day (the most either keeps),
 * in that order. Only the days that keep any.
 */
function listKeptLessonDays({
  challenge,
  from,
  promised,
  to,
}: {
  challenge: LessonDays | undefined;
  from: string;
  promised: LessonDays;
  to: string;
}): Map<string, Map<string, number>> {
  const byDay = new Map<string, Map<string, number>>();

  for (const [key, days] of [...(challenge ?? []), ...promised]) {
    for (const [date, minutes] of days) {
      if (date >= from && date <= to) {
        const lessons = byDay.get(date) ?? new Map<string, number>();
        lessons.set(key, Math.max(lessons.get(key) ?? 0, minutes));
        byDay.set(date, lessons);
      }
    }
  }

  return byDay;
}

/**
 * The day minutes a day keeps from a mock's funding (see `getSpendable`), after its fixed events:
 * its kept lesson minutes (see `listKeptLessonDays`) at the day's own share now. Equal layouts can
 * sum a day's lesson minutes in a different order: rounded, the same plan funds its mocks with the
 * same minutes, so a run on it saves nothing new.
 */
function getKeptMinutes({
  lessons,
  share,
}: {
  lessons: ReadonlyMap<string, number> | undefined;
  share: number;
}): number {
  const lessonMinutes = [...(lessons?.values() ?? [])].reduce(
    (total, minutes) => total + minutes,
    0,
  );

  return Math.round(toDayMinutes({ lessonMinutes, share }) / KEPT_PRECISION) * KEPT_PRECISION;
}

/**
 * Where a mock's funding stops reading what days keep: before the next mock the plan lays (a
 * relocation stops there, see `findRelocation`, and that mock's funding keeps its own days again).
 */
function findReadEnd({ days, index }: { days: readonly PlanDay[]; index: number }): number {
  for (let at = Math.max(0, index + 1); at < days.length; at += 1) {
    const day = days[at];

    if (day && findDayMock(day.shape)) {
      return at;
    }
  }

  return days.length;
}

/** The teaching a mock's funding never takes: the promised lesson's, and the challenges' (see `getKeptMinutes`). */
export type KeptTeaching = { promised: LessonDays; tested: TestedTeaching };

/** No teaching kept: every day's time can fund a mock. */
export const NOTHING_KEPT: KeptTeaching = { promised: new Map(), tested: [] };

/**
 * The days a mock's funding reads, from its window's start (`windowStart`, an index of `days`) to
 * the day before the next mock (see `findReadEnd`), each keeping the teaching the window's
 * challenge tests (see `findWindowChallenge`) and the promised lesson's, at its share now (see
 * `getKeptMinutes`; a mock's own day keeps none, its funding decides; one keeping nothing keeps
 * nothing an earlier mock's funding left it): whether the mock's own day (`date`, at `index`) holds
 * lessons that challenge tests, which no mock replaces (see `findMockFunding`). `labels` are the
 * days' ISO dates.
 */
export function keepWindowTeaching({
  date,
  days,
  index,
  kept,
  labels,
  shapes,
  windowStart,
}: {
  date: string;
  days: readonly PlanDay[];
  index: number;
  kept: KeptTeaching;
  labels: readonly string[];
  shapes: DayShape[];
  windowStart: number;
}): boolean {
  const start = labels[windowStart] ?? "";
  const end = findReadEnd({ days, index });

  const challenge = findWindowChallenge({
    mockDate: date,
    tested: kept.tested,
    windowStart: start,
  });

  const lessonDays = listKeptLessonDays({
    challenge: challenge?.lessons,
    from: start,
    promised: kept.promised,
    to: labels[end - 1] ?? start,
  });

  for (let at = windowStart; at < end; at += 1) {
    const shape = shapes[at];

    if (shape && !findDayMock(shape)) {
      const { kept: residue, ...rest } = shape;
      const lessons = lessonDays.get(labels[at] ?? "");
      const minutes = lessons ? getKeptMinutes({ lessons, share: shape.share }) : 0;

      if (minutes > 0) {
        shapes[at] = { ...rest, kept: minutes };
      } else if (residue !== undefined) {
        shapes[at] = rest;
      }
    }
  }

  return [...(challenge?.lessons.values() ?? [])].some((onDays) => (onDays.get(date) ?? 0) > 0);
}

import { getBossSkillIds } from "../../checkpoints/checkpoint-rules";
import { type ItemSkillRows } from "../../learner/_utils/goal-plan-projection";
import { type BossCandidate, listBossCandidates, projectBossPlan } from "./boss-projection";
import { type BuildPlanInput } from "./build-plan";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { type PlannedItem } from "./plan-items";
import { type PlanPhase } from "./plan-state";
import { type FixedEvent, type PlanDay } from "./schedule-units";

/**
 * Where an exam's phase challenges go, by key (see `placeExamBosses`): their day, whether it's
 * beside the lessons they test on their last day, with no study day left after them, and the keys
 * of the lessons they test there (`tested`), which the next pass keeps them after.
 */
export type ExamBossDays = ReadonlyMap<
  string,
  { beside: boolean; date: string; tested?: readonly string[] }
>;

const LEARN_KINDS = new Set<PlannedItem["kind"]>(["chapter", "lesson"]);

/** Whether two challenges test the same lessons, in any order. */
function isSameTested(first?: readonly string[], second?: readonly string[]): boolean {
  const tested = new Set(first);
  return tested.size === new Set(second).size && (second ?? []).every((key) => tested.has(key));
}

/** Whether two exam challenges' days, and what each tests there, are the same. */
export function isSameBossDays(first: ExamBossDays, second: ExamBossDays): boolean {
  return (
    first.size === second.size &&
    [...first].every(([key, day]) => {
      const other = second.get(key);

      return (
        other?.date === day.date &&
        other.beside === day.beside &&
        isSameTested(other.tested, day.tested)
      );
    })
  );
}

/**
 * The day an exam's phase challenge goes, as a built plan lays its lessons out: the first study
 * day after the lessons it tests end (`getBossSkillIds`, with the time each lesson takes,
 * `teachingEnds`), so a day passes between learning and being tested; with none before the exam,
 * the day they end, beside them. It starts from the day the challenge had (its window's end on a
 * plan's first pass) and moves until what it tests and its day agree: later, it tests no fewer.
 * What it tests is what it asks once saved: the plan's items with every challenge the run places
 * where it tries it, in the saved plan's order (see `projectBossPlan`), read by the rule sizing and
 * the session read (`getBossSkillIds`). What it tested on the pass before (`earlier`) of the skills
 * it still asks it still comes after: a lesson of its own that slipped past its day moves it, and
 * its questions stay; one another challenge asks never holds it. One the plan keeps (finished,
 * skipped, or this week's) stays where it is. One that tests nothing on its day moves to the
 * first later study day it tests something on: kept there, the entrance exam's three challenges
 * took a mock week's time from the lessons they test, then tested nothing, and so on, forever. With
 * nothing to test on any day, it keeps its day (an unavailable one, see `getBossSize`).
 */
export function placeExamBosses({
  built,
  input,
  rows,
  survivors,
}: {
  built: {
    items: readonly PlannedItem[];
    keptKeys: ReadonlySet<string>;
    phases: readonly PlanPhase[];
    skillLessons: ReadonlyMap<string, number>;
    studyDays: readonly string[];
    teachingEnds: ReadonlyMap<string, Date>;
  };
  input: Pick<BuildPlanInput, "graph" | "settings">;
  rows?: ItemSkillRows;
  survivors?: ReadonlyMap<string, string>;
}): ExamBossDays {
  const candidates = listBossCandidates({ built });

  const { at, plan, without } = projectBossPlan({ built, candidates, input, rows, survivors });

  const learn = plan.items.filter((item) => LEARN_KINDS.has(item.kind) && item.scheduledFor);
  const endOf = (item: PlannedItem) => built.teachingEnds.get(item.key) ?? item.scheduledFor;

  // The skills a challenge asks on `day` with every other one where the run tries it: leading the
  // day, after the lessons before it; beside them (`afterDay`), after the day's own lessons too.
  const listAsked = ({ afterDay, day, key, phase }: Spot) => {
    const position = at({ beside: afterDay, day, key, phase });

    return new Set(
      getBossSkillIds({ ...without(key), boss: { phase, position, scheduledFor: day } }),
    );
  };

  const listTested = (spot: Spot) => {
    const asked = listAsked(spot);
    const position = at({ beside: spot.afterDay, day: spot.day, key: spot.key, phase: spot.phase });

    return learn.filter(
      (item) =>
        item.position < position &&
        (plan.itemSkillIds.get(item.id) ?? []).some((skillId) => asked.has(skillId)),
    );
  };

  const ends = learn
    .map((item) => endOf(item))
    .filter((end): end is Date => end !== undefined && end !== null);

  // The days a challenge's content can change on: the first study day after each lesson's end.
  const eventDays = [
    ...new Set(
      ends.flatMap((end) => {
        const day = findStudyDayAfter(built.studyDays, toIsoDate(end));
        return day ? [day] : [];
      }),
    ),
  ].toSorted();

  // What a challenge tests on `date`: leading the day, else after the day's own lessons.
  const listOn = ({ date, key, phase }: { date: string; key: string; phase: number }) => {
    const day = fromIsoDate(date);
    const leading = listTested({ afterDay: false, day, key, phase });
    return leading.length > 0 ? leading : listTested({ afterDay: true, day, key, phase });
  };

  const lastEnd = (items: readonly PlannedItem[]) =>
    items.reduce<string | null>((latest, item) => {
      const end = endOf(item);
      const day = end ? toIsoDate(end) : null;
      return day && (!latest || day > latest) ? day : latest;
    }, null);

  // From its window's end, the first study day on which everything it tests there has ended,
  // moving only forward: past what it tests, or to the next day its content can change on.
  const placeOne = (candidate: BossCandidate) => {
    const { key, phase } = candidate;
    const anchor = candidate.date;
    const atAnchor = lastEnd(listOn({ date: anchor, key, phase }));

    const date: string | undefined = atAnchor
      ? findStudyDayAfter(built.studyDays, atAnchor)
      : (eventDays.find((day) => day > anchor) ?? anchor);

    if (!date) {
      return { beside: true, date: atAnchor ?? anchor, tested: [] as string[] };
    }

    // Each step moves past what it tests on its day, or, testing nothing, to the next day its
    // content can change on; with none left, it keeps its anchor, or goes beside what it tests.
    for (let day: string | undefined = date; day;) {
      const on: string = day;
      const tested = listOn({ date: on, key, phase });
      const end = lastEnd(tested);
      const keys = tested.map((item) => item.key);

      if (tested.length > 0 && end !== null && end < on) {
        return { beside: false, date: on, tested: keys };
      }

      day =
        end === null
          ? eventDays.find((event) => event > on)
          : findStudyDayAfter(built.studyDays, end > on ? end : on);

      if (!day && end !== null) {
        return { beside: true, date: end, tested: keys };
      }
    }

    return {
      beside: false,
      date: anchor,
      tested: listOn({ date: anchor, key, phase }).map((item) => item.key),
    };
  };

  // A challenge the plan keeps this week stays where it is, testing what it asks there.
  const keptBosses = plan.items.flatMap((boss) => {
    if (boss.kind !== "boss" || boss.status !== "todo" || !built.keptKeys.has(boss.key)) {
      return [];
    }

    const asked = new Set(getBossSkillIds({ ...plan, boss }));

    const tested = learn.filter(
      (item) =>
        item.position < boss.position &&
        (plan.itemSkillIds.get(item.id) ?? []).some((skillId) => asked.has(skillId)),
    );

    const date = boss.scheduledFor ? toIsoDate(boss.scheduledFor) : "";
    return [[boss.key, { beside: false, date, tested: tested.map((item) => item.key) }] as const];
  });

  return new Map([
    ...keptBosses,
    ...candidates.map((candidate) => [candidate.key, placeOne(candidate)] as const),
  ]);
}

/** The first study day after `date` (an ISO date), by binary search over the sorted days. */
function findStudyDayAfter(days: readonly string[], date: string): string | undefined {
  let low = 0;
  let high = days.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);

    if ((days[middle] ?? "") <= date) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return days[low];
}

/** A day a challenge is tried on, leading it or after its lessons (`afterDay`). */
type Spot = { afterDay: boolean; day: Date; key: string; phase: number };

/**
 * The days an exam's phase challenge can go (see `placeExamBosses`): with study time, before the
 * exam's eve, and not a weekly mock's own day. A day a mock was moved onto (`movedTo`: the
 * learner's move, or a run's, see `findRelocation`) still is: the two share it when its days fund
 * both, else the mock moves on.
 */
function listStudyDays({
  days,
  movedTo,
  targetDate,
}: {
  days: readonly PlanDay[];
  movedTo: ReadonlySet<string>;
  targetDate: Date | null;
}): string[] {
  const eve = targetDate ? addDays(targetDate, -1).getTime() : null;

  return days.flatMap((day) => {
    if (day.shape.minutes <= 0 || day.date.getTime() === eve) {
      return [];
    }

    const date = toIsoDate(day.date);
    const ownMock = day.shape.events.some((event) => event.kind === "mock" && event.replacesDay);
    return !ownMock || movedTo.has(date) ? [date] : [];
  });
}

/**
 * The days a pass places an exam's challenges, never earlier than the pass before put them: a
 * challenge's own time can push the end of the lessons it tests (a stand-in spanning its day)
 * past it, and moving back would free that time and pull the end back, and so on; on the same day,
 * one beside its lessons stays beside them, taking none of their time. Later, it still comes after
 * everything it tests, and the plan settles on it. Only while it tests the same lessons: one whose
 * lessons changed (a stale one let go, see `placeExamBosses`) goes where they put it.
 */
export function keepLaterBossDays({
  earlier,
  placed,
}: {
  earlier: ExamBossDays;
  placed: ExamBossDays;
}): ExamBossDays {
  return new Map(
    [...placed].map(([key, day]) => {
      const before = earlier.get(key);

      const keeps =
        before && (before.date > day.date || (before.date === day.date && before.beside));

      return [key, keeps ? { ...before, tested: day.tested } : day] as const;
    }),
  );
}

/**
 * The phase challenges a run's settled days put on a date (see `placeExamBosses`): each its own
 * phase's, wherever its day falls, beside its lessons when no study day was left after them.
 */
export function listBossEvents({
  bossDays,
  bossMinutes,
  date,
}: {
  bossDays: ExamBossDays;
  bossMinutes: (phase: number) => number;
  date: Date;
}): FixedEvent[] {
  const day = toIsoDate(date);

  return [...bossDays].flatMap(([key, placed]) => {
    const phase = Number(key.slice(key.indexOf(":") + 1));

    return placed.date === day
      ? [
          {
            key,
            kind: "boss" as const,
            minutes: bossMinutes(phase),
            replacesDay: false,
            title: "",
            ...(placed.beside ? { beside: true } : { leads: true }),
            ownPhase: phase,
          },
        ]
      : [];
  });
}

/**
 * What a built plan says of where its exam's phase challenges can go (see `placeExamBosses`): the
 * study days (`listStudyDays`; a day a mock was moved onto, by the learner or a run, is one), and
 * the day each scheduled lesson's time ends, when later than its date, this week's kept lessons'
 * included (`kept`, by their last day of time, see `layOutAfterThisWeek`): a run that keeps a stand-in
 * this week tests it where its time ends, as a run that lays it out again does.
 */
export function listBossDayFacts({
  days,
  input,
  kept,
  units,
}: {
  days: readonly PlanDay[];
  input: Pick<BuildPlanInput, "goal" | "settings">;
  kept: ReadonlyMap<string, readonly { date: string }[]>;
  units: readonly { key: string; teachingEnd?: Date }[];
}): { studyDays: string[]; teachingEnds: Map<string, Date> } {
  const { mockRelocations, movedEvents } = input.settings;

  const teachingEnds = new Map(
    units.flatMap((unit) => (unit.teachingEnd ? [[unit.key, unit.teachingEnd] as const] : [])),
  );

  for (const [key, portions] of kept) {
    const last = portions
      .map((portion) => portion.date)
      .toSorted()
      .at(-1);

    const end = last && fromIsoDate(last);
    const laid = teachingEnds.get(key);

    if (end && (!laid || end > laid)) {
      teachingEnds.set(key, end);
    }
  }

  return {
    studyDays: listStudyDays({
      days,
      movedTo: new Set([...movedEvents, ...mockRelocations].map((move) => move.to)),
      targetDate: input.goal.targetDate,
    }),
    teachingEnds,
  };
}

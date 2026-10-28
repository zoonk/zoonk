import { getBossSkillIds, isBossTeachingItem } from "../../checkpoints/checkpoint-rules";
import { type ItemSkillRows } from "../../learner/_utils/goal-plan-projection";
import { type BossCandidate, listBossCandidates, projectBossPlan } from "./boss-projection";
import { type BuildPlanInput } from "./build-plan";
import { getExamChallengeDayRules, listPhaseChallengeDays } from "./phase-challenge-days";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { type PlannedItem, getItemKey } from "./plan-items";
import { type PlanPhase } from "./plan-state";
import { type FixedEvent, type PlanDay } from "./schedule-units";

/**
 * Where an exam's phase challenges go, by key (see `placeExamBosses`): their day, whether it's
 * beside the lessons they test on their last day, with no study day left after them, and the keys
 * of the lessons they test there (`tested`).
 */
export type ExamBossDays = ReadonlyMap<
  string,
  { beside: boolean; date: string; tested?: readonly string[] }
>;

/** The last day a joined stand-in teaches before its exam, without its later continuation. */
function getLastTeachingDay({
  before,
  days,
}: {
  before: string;
  days: ReadonlyMap<string, number> | undefined;
}): Date | undefined {
  const last = [...(days?.keys() ?? [])]
    .filter((day) => day < before)
    .toSorted()
    .at(-1);

  return last ? fromIsoDate(last) : undefined;
}

/** Prefer the exam's remaining challenge days; retain continuation days once none can hold it. */
function getChallengeDays({
  days,
  exam,
}: {
  days: readonly string[];
  exam: string | null;
}): readonly string[] {
  const before = days.filter((day) => exam !== null && day < exam);
  return before.length > 0 ? before : days;
}

/**
 * The day an exam's phase challenge goes, as a built plan lays its lessons out: the first study
 * day after every lesson its own phase teaches has ended (with the time each takes, `teachingEnds`),
 * so it never comes while its phase's lessons still run, and
 * a day passes between learning and being tested; with none before the exam, the day they end,
 * beside them. While its challenge days remain before the exam, only teaching before it counts;
 * later continuation leaves that challenge unchanged. It tests its own phase's teaching and asks its skills once
 * saved: the plan's items with every challenge the run places where it tries it, in the saved
 * plan's order (see `projectBossPlan`), read by the rule sizing and the session read
 * (`getBossSkillIds`). A phase that teaches nothing of its own (an exam's window of practice and
 * mocks) starts from its window's end and moves until what it asks from before it and its day
 * agree: later, it tests no fewer; one that tests nothing on its day moves to the first later study
 * day it tests something on (kept there, the entrance exam's three challenges took a mock week's
 * time from the lessons they test, then tested nothing, and so on, forever); with nothing to test
 * on any day, it keeps its day (an unavailable one, see `getBossSize`). One the plan keeps
 * (finished, skipped, or this week's) stays where it is.
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
    lessonRawMinutes: ReadonlyMap<string, ReadonlyMap<string, number>>;
    phases: readonly PlanPhase[];
    skillLessons: ReadonlyMap<string, number>;
    studyDays: readonly string[];
    teachingEnds: ReadonlyMap<string, Date>;
  };
  input: Pick<BuildPlanInput, "goal" | "graph" | "items" | "settings">;
  rows?: ItemSkillRows;
  survivors?: ReadonlyMap<string, string>;
}): ExamBossDays {
  const candidates = listBossCandidates({ built });
  const exam = input.goal.targetDate && toIsoDate(input.goal.targetDate);

  // A day the learner moved a mock onto holds only the challenge the plan they saw had there: they
  // moved the mock onto it. One a run carries there (left on an earlier day, or its teaching ended
  // sooner) goes on the next study day: its time runs on top of its day, and a mock's is long.
  const movedOnto = new Set(input.settings.movedEvents.map((move) => move.to));

  const savedDays = new Map(
    input.items.flatMap((item) =>
      item.kind === "boss" && item.scheduledFor
        ? [[getItemKey(item), toIsoDate(item.scheduledFor)] as const]
        : [],
    ),
  );

  const canGoOn = (key: string, day: string) => !movedOnto.has(day) || savedDays.get(key) === day;

  const listStudyDays = (key: string) =>
    getChallengeDays({ days: built.studyDays.filter((day) => canGoOn(key, day)), exam });

  const { at, plan, without } = projectBossPlan({ built, candidates, input, rows, survivors });

  const learn = plan.items.filter((item) => isBossTeachingItem(item) && item.scheduledFor);

  // A joined stand-in can continue after the exam. That continuation must not move a challenge
  // the exam's own schedule already held: only its teaching before the exam closes that phase.
  const endOf = (item: PlannedItem, studyDays: readonly string[]) =>
    (exam && studyDays[0] && studyDays[0] < exam
      ? getLastTeachingDay({ before: exam, days: built.lessonRawMinutes.get(item.key) })
      : undefined) ??
    built.teachingEnds.get(item.key) ??
    item.scheduledFor;

  // The skills a challenge asks on `day` with every other one where the run tries it: leading the
  // day, after the lessons before it; beside them (`afterDay`), after the day's own lessons too.
  const listAsked = ({ afterDay, day, key, phase }: Spot) => {
    const position = at({ beside: afterDay, day, key, phase });

    return new Set(
      getBossSkillIds({ ...without(key), boss: { phase, position, scheduledFor: day } }),
    );
  };

  const asks = (item: (typeof learn)[number], asked: ReadonlySet<string>) =>
    (plan.itemSkillIds.get(item.id) ?? []).some((skillId) => asked.has(skillId));

  // What a phase without teaching of its own asks at a spot, from lessons already before it.
  const listTested = (spot: Spot) => {
    const asked = listAsked(spot);
    const position = at({ beside: spot.afterDay, day: spot.day, key: spot.key, phase: spot.phase });

    return learn.filter((item) => item.position < position && asks(item, asked));
  };

  // What a challenge tests of those: its own phase's lessons, or, for a phase that teaches nothing
  // of its own (an exam's window of practice and mocks), what it asks from before it.
  const keepOwn = (tested: readonly (typeof learn)[number][], phase: number) => {
    const own = tested.filter((item) => item.phase === phase);
    return (own.length > 0 ? own : tested).map((item) => item.key);
  };

  // What a challenge tests on `date`: leading the day, else after the day's own lessons.
  const listOn = ({ date, key, phase }: { date: string; key: string; phase: number }) => {
    const day = fromIsoDate(date);
    const leading = listTested({ afterDay: false, day, key, phase });
    return leading.length > 0 ? leading : listTested({ afterDay: true, day, key, phase });
  };

  const lastEnd = (items: readonly PlannedItem[], studyDays: readonly string[]) =>
    items.reduce<string | null>((latest, item) => {
      const end = endOf(item, studyDays);
      const day = end ? toIsoDate(end) : null;
      return day && (!latest || day > latest) ? day : latest;
    }, null);

  const shown = new Set(plan.skills.map((skill) => skill.id));

  const listOwnTeaching = (phase: number) =>
    learn.filter(
      (item) =>
        item.phase === phase &&
        (plan.itemSkillIds.get(item.id) ?? []).some((skillId) => shown.has(skillId)),
    );

  // The first study day after its own teaching ends, including every day of a stand-in. Other
  // phases' teaching cannot delay it. With none left, beside its own teaching on its last day. A
  // phase that teaches nothing of its own goes from its window's end (see `placeAfterWindow`).
  const placeOne = (candidate: BossCandidate) => {
    const { phase } = candidate;
    const own = listOwnTeaching(phase);
    const studyDays = listStudyDays(candidate.key);
    const lastTaught = lastEnd(own, studyDays);

    if (!lastTaught) {
      return placeAfterWindow(candidate);
    }

    const day = findStudyDayAfter(studyDays, lastTaught);

    return {
      beside: day === undefined,
      date: day ?? lastTaught,
      tested: own.map((item) => item.key),
    };
  };

  // From its window's end, the first study day on which everything it tests there has ended,
  // moving only forward: past what it tests, or to the next day its content can change on.
  const placeAfterWindow = (candidate: BossCandidate) => {
    const { key, phase } = candidate;
    const anchor = candidate.date;
    const studyDays = listStudyDays(key);
    const atAnchor = lastEnd(listOn({ date: anchor, key, phase }), studyDays);

    const ends = learn
      .map((item) => endOf(item, studyDays))
      .filter((end): end is Date => end !== undefined && end !== null);

    // Content changes on this challenge's first eligible study day after each lesson's end.
    const changeDays = [
      ...new Set(
        ends.flatMap((end) => {
          const day = findStudyDayAfter(studyDays, toIsoDate(end));
          return day ? [day] : [];
        }),
      ),
    ].toSorted();

    const date: string | undefined = atAnchor
      ? findStudyDayAfter(studyDays, atAnchor)
      : (changeDays.find((day) => day > anchor) ?? anchor);

    if (!date) {
      return { beside: true, date: atAnchor ?? anchor, tested: [] as string[] };
    }

    // Each step moves past what it tests on its day, or, testing nothing, to the next day its
    // content can change on; with none left, it keeps its anchor, or goes beside what it tests.
    for (let day: string | undefined = date; day;) {
      const on: string = day;
      const tested = listOn({ date: on, key, phase });
      const end = lastEnd(tested, studyDays);
      const keys = tested.map((item) => item.key);

      if (tested.length > 0 && end !== null && end < on) {
        return { beside: false, date: on, tested: keys };
      }

      day =
        end === null
          ? changeDays.find((event) => event > on)
          : findStudyDayAfter(studyDays, end > on ? end : on);

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
    const tested = learn.filter((item) => item.position < boss.position && asks(item, asked));
    const date = boss.scheduledFor ? toIsoDate(boss.scheduledFor) : "";
    return [[boss.key, { beside: false, date, tested: keepOwn(tested, boss.phase) }] as const];
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
 * A day's events with the phase challenges a run places on it (see `listBossEvents`): a review
 * fills what the day has left, so it gives the time of the challenges that lead the day (R45).
 * Laid beside a review of the whole day, two challenges asked a 45-minute day for 68 minutes.
 */
export function withBossEvents({
  bosses,
  events,
}: {
  bosses: readonly FixedEvent[];
  events: readonly FixedEvent[];
}): FixedEvent[] {
  const taken = bosses.reduce((total, boss) => total + (boss.beside ? 0 : boss.minutes), 0);

  const kept =
    taken > 0
      ? events.map((event) =>
          event.kind === "review"
            ? { ...event, minutes: Math.max(0, event.minutes - taken) }
            : event,
        )
      : events;

  return [...kept, ...bosses];
}

/**
 * What a built plan says of where its exam's phase challenges can go (see `placeExamBosses`): the
 * study days (`listPhaseChallengeDays`; a day a mock was moved onto, by the learner or a run, is
 * one), and the day each scheduled lesson's time ends, when later than its date, this week's kept
 * lessons' included (`kept`, by their last day of time, see `layOutAfterThisWeek`): a run that
 * keeps a stand-in this week tests it where its time ends, as a run that lays it out again does.
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

  // Every plan's: a run reads them only for a dated exam's challenges, and they are the same days.
  const rules = getExamChallengeDayRules({
    settings: input.settings,
    targetDate: input.goal.targetDate,
  });

  return { studyDays: listPhaseChallengeDays({ days, rules }), teachingEnds };
}

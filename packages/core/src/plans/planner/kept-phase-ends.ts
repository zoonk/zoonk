import { type BuildPlanInput } from "./build-plan";
import { findDayIndex, isLessonRoom } from "./day-index";
import { canHoldPhaseChallenge } from "./phase-challenge-days";
import { listWonPhases } from "./phase-time";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { type ExistingPlanItem, type PlannedItem } from "./plan-items";
import { type PlanPhase } from "./plan-state";
import { type QueueUnit, getBossKey } from "./plan-units";
import {
  type PlanDay,
  type ScheduledUnit,
  getCumulativeCapacity,
  getLessonCapacity,
  getUsedAfterUnits,
  placeUnits,
} from "./schedule-units";
import { withKeptLessons } from "./whole-boss";

/** Floating-point sums of lesson minutes must not push a lesson past its phase's end. */
const EPSILON = 1e-6;

const LEARN_KINDS = new Set<PlannedItem["kind"]>(["chapter", "lesson"]);

/**
 * The end dates a learn plan's phases were last saved with, which the learner saw on the plan's
 * reveal and on Plan, by phase: every phase but the last, whose end the goal's finish says,
 * whose challenge is still to do on that day, or won early while the phase's lessons are still to
 * do (career 2110 won one three weeks early, and its phase then ended on its last lesson left, two
 * days sooner). None for an exam, whose phases are windows of the calendar that never move. A plan
 * short on time can have no room for a phase's challenge, and the phase then ends on its last
 * lesson or weekly challenge: kept as if its challenge were there, the next run brought the
 * challenge in on that day, and the run after it left it out again.
 */
export function getShownPhaseEnds({
  items,
  moved = new Map(),
  phases,
  released = new Set(),
}: {
  items: readonly Pick<ExistingPlanItem, "kind" | "phase" | "scheduledFor" | "status">[];
  /** The ends moving the phase dates puts on other days, by phase (see `moveStrainedEnds`). */
  moved?: ReadonlyMap<number, string>;
  phases: readonly PlanPhase[];
  /**
   * Phases whose end isn't kept: their challenge would come before lessons it tests (see
   * `listEndsBeforeLessons`), so a missed day's settling, or moving the phase dates, lets it go.
   */
  released?: ReadonlySet<number>;
}): Map<number, Date> {
  if (phases.some((phase) => phase.kind !== "learn")) {
    return new Map();
  }

  const challengeDays = new Set(
    items.flatMap((item) =>
      item.kind === "boss" && item.status === "todo" && item.scheduledFor
        ? [`${item.phase}:${toIsoDate(item.scheduledFor)}`]
        : [],
    ),
  );

  const won = listWonPhases(items);

  const shown = phases
    .slice(0, -1)
    .flatMap((phase, index) =>
      phase.endDate && (won.has(index) || challengeDays.has(`${index}:${phase.endDate}`))
        ? [[index, phase.endDate] as const]
        : [],
    );

  return new Map(
    [...new Map([...shown, ...moved])].flatMap(([index, date]) =>
      released.has(index) ? [] : [[index, fromIsoDate(date)]],
    ),
  );
}

/**
 * The index of the day a phase ends on, among the days the run lays out, even one with no lesson
 * time left: its challenge stays there all the same (see `listStrainedEnds`).
 */
function findEndDay({ date, days }: { date: Date; days: readonly PlanDay[] }): number | null {
  const index = days.findIndex((day) => day.date.getTime() === date.getTime());
  return index === -1 ? null : index;
}

/**
 * Where the day the units before a challenge end on ends: the rest of it stays free, as on a plan
 * that lays the challenge out the study day after them (see `placeBoss`).
 */
function getDayEndAfter({
  cumulative,
  units,
}: {
  cumulative: readonly number[];
  units: readonly QueueUnit[];
}): number {
  const used = getUsedAfterUnits({ cumulative, units });
  const day = used <= EPSILON ? -1 : findDayIndex({ cumulative, needed: used });

  return day === -1 ? used : Math.max(used, cumulative[day] ?? used);
}

/**
 * The lessons of this phase (or an earlier one) queued after its challenge that fit in the time
 * left before it, in order: a plan short on time studies depth once every core is in, and the days
 * a phase no longer needs are its own depth's first.
 */
function pullPhaseDepth({
  phase,
  later,
  room,
}: {
  later: readonly QueueUnit[];
  phase: number;
  /** The lesson minutes left before the challenge. */
  room: number;
}): QueueUnit[] {
  const candidates = later.filter((unit) => unit.kind === "lesson" && unit.phase <= phase);

  const ends = candidates.reduce<number[]>((sums, unit) => {
    sums.push((sums.at(-1) ?? 0) + unit.minutes);
    return sums;
  }, []);

  const count = ends.findIndex((end) => end > room + EPSILON);
  return count === -1 ? candidates : candidates.slice(0, count);
}

/**
 * A phase's challenge on the day its phase ends when earlier phases' challenges, which a day the
 * learner half studied or missed left undone, no longer fit before it: they come first, in phase
 * order, right before this one, and the lessons that don't fit before them all give way to after
 * them. A studied day never moves a phase end the learner saw (R6, R9). Pinned before the earlier
 * challenge, a career plan's next challenge came first; kept after its lessons, the phase ended two
 * days later; with only the last of two earlier challenges brought along, the other ended its
 * phase after this one (R39).
 */
function keepAfterEarlierChallenges({
  after,
  before,
  boss,
  cumulative,
  endDay,
  late,
  start,
}: {
  after: readonly QueueUnit[];
  before: readonly QueueUnit[];
  boss: QueueUnit;
  cumulative: readonly number[];
  endDay: number;
  /** Where in `before` the first unit that doesn't fit by this challenge's start is. */
  late: number;
  /** Where this challenge starts in the plan's lessons minutes. */
  start: number;
}): QueueUnit[] {
  const isEarlier = (unit: QueueUnit, index: number) =>
    index >= late && unit.kind === "boss" && unit.phase < boss.phase;

  const challenges = before
    .filter((unit, index) => isEarlier(unit, index))
    .toSorted((first, second) => first.phase - second.phase);

  const rest = before.filter((unit, index) => !isEarlier(unit, index));
  const minutes = challenges.reduce((total, unit) => total + unit.minutes, 0);
  const room = Math.max(0, start - minutes);

  const restLate = placeUnits({ cumulative, units: rest }).findIndex(
    ({ dayIndex, start: unitStart, unit }) =>
      dayIndex < 0 || unitStart + unit.minutes > room + EPSILON,
  );

  const count = restLate === -1 ? rest.length : restLate;
  const first = rest.slice(0, count);

  // Those that would still run past the end day share it with this one, earlier phase first.
  const held = placeUnits({ cumulative, units: [...first, ...challenges] })
    .slice(first.length)
    .map(({ dayIndex, unit }) =>
      dayIndex < 0 || dayIndex > endDay ? { ...unit, heldOn: endDay } : unit,
    );

  return [
    ...first,
    ...held,
    { ...boss, heldOn: endDay, startsAt: start },
    ...rest.slice(count),
    ...after,
  ];
}

/**
 * Puts one phase's challenge on the day the phase ends: no earlier when its lessons take less time
 * than planned (the time left goes to the phase's own depth, else its last days get lighter). When
 * they take more, so a lesson before it no longer ends by the day before, the end isn't kept: the
 * challenge never tests what the learner isn't taught yet, nor on the day it's taught.
 */
function keepPhaseEnd({
  boss,
  cumulative,
  endDay,
  units,
}: {
  boss: QueueUnit;
  cumulative: readonly number[];
  endDay: number;
  units: readonly QueueUnit[];
}): QueueUnit[] {
  const index = units.findIndex((unit) => unit.key === boss.key);
  const before = units.slice(0, index);
  const after = units.slice(index + 1);

  // It leads its own day, a day after the lessons before it (see `placeBoss`).
  const start = cumulative[endDay - 1] ?? 0;

  const late = placeUnits({ cumulative, units: before }).findIndex(
    ({ dayIndex, start: unitStart, unit }) =>
      dayIndex < 0 || unitStart + unit.minutes > start + EPSILON,
  );

  // A lesson before it that no longer ends by the day before (a missed day left it, or it took
  // longer, or the run keeps it on that day or later, `after`) would be tested before it's taught,
  // or the same day: the end isn't kept, and the challenge comes the first study day after its
  // lessons, Today offering the dates' move.
  const lateLesson =
    (late !== -1 && before.slice(late).some((unit) => LEARN_KINDS.has(unit.kind))) ||
    (boss.afterDay ?? -1) >= endDay;

  if (lateLesson) {
    return [...units];
  }

  // Earlier phases' challenges that no longer fit by this end (a day left them undone) come first,
  // right before this one (see `keepAfterEarlierChallenges`).
  const earlier = before.findLastIndex((unit) => unit.kind === "boss" && unit.phase < boss.phase);

  if (late !== -1 && late <= earlier) {
    return keepAfterEarlierChallenges({ after, before, boss, cumulative, endDay, late, start });
  }

  if (late !== -1) {
    return [
      ...before.slice(0, late),
      { ...boss, heldOn: endDay, startsAt: start },
      ...before.slice(late),
      ...after,
    ];
  }

  // The challenge right after the phase's lessons, as the run that made the plan laid it out, ends
  // on the phase's last day; only the time that no longer reaches it takes depth.
  const pulled = pullPhaseDepth({
    later: after,
    phase: boss.phase,
    room: start - getDayEndAfter({ cumulative, units: before }),
  });

  const pulledKeys = new Set(pulled.map((unit) => unit.key));

  return [
    ...before,
    ...pulled,
    { ...boss, heldOn: endDay, startsAt: start },
    ...after.filter((unit) => !pulledKeys.has(unit.key)),
  ];
}

/**
 * Keeps a learn plan's phase end dates, the ones the learner saw (see `getShownPhaseEnds`), while
 * a system refresh lays out lessons the Library wrote since, which take a little more or less time
 * than the plan estimated: each phase's challenge stays on the day its phase ends, and the
 * difference stays inside the phase. A phase whose end has passed is left as it comes; one whose
 * end day has no room for its challenge keeps it there all the same, never moved without the
 * learner, and Today offers to move the dates (see `listStrainedEnds`). A learner's own change
 * re-plans without it, so the dates follow what they asked.
 */
export function keepPhaseEnds({
  days,
  ends,
  units: given,
}: {
  days: readonly PlanDay[];
  ends: ReadonlyMap<number, Date>;
  units: readonly QueueUnit[];
}): QueueUnit[] {
  if (ends.size === 0) {
    return [...given];
  }

  const cumulative = getCumulativeCapacity(days);
  const units = withKeptLessons({ days, units: given });

  const pinned = units.flatMap((unit) => {
    const date = unit.kind === "boss" ? ends.get(unit.phase) : undefined;
    const endDay = date ? findEndDay({ date, days }) : null;

    return endDay === null ? [] : [{ boss: unit, endDay }];
  });

  return pinned.reduce<QueueUnit[]>(
    (queue, { boss, endDay }) => keepPhaseEnd({ boss, cumulative, endDay, units: queue }),
    [...units],
  );
}

/**
 * A kept phase end whose challenge holds a day without room for it: `resting`, one the learner
 * rests; `room`, the first later day with lesson time and no other challenge, where moving the
 * phase dates puts it (see `moveStrainedEnds`), or null when the plan has none.
 */
export type StrainedEnd = { phase: number; resting: boolean; room: string | null };

/** The first day after `date` with lesson time that holds no other phase's challenge. */
function findRoomDay({
  date,
  days,
  phase,
  units,
}: {
  date: Date;
  days: readonly PlanDay[];
  phase: number;
  units: readonly ScheduledUnit[];
}): string | null {
  const challengeDays = new Set(
    units.flatMap((unit) =>
      unit.kind === "boss" && unit.phase !== phase ? [unit.date.getTime()] : [],
    ),
  );

  const room = days.find(
    (day) =>
      day.date > date &&
      canHoldPhaseChallenge({ day, rules: { kind: "lessons" } }) &&
      !challengeDays.has(day.date.getTime()),
  );

  return room ? toIsoDate(room.date) : null;
}

/**
 * The kept phase ends whose challenge holds its day past what the day has: a day with no lesson
 * time (the learner rests then), or more than its time (two challenges a half-studied day left on
 * it), not a challenge simply longer than a day. The date the learner saw stays, and Today offers
 * to move the phase dates (see `updatePhaseDatesProposal`).
 */
export function listStrainedEnds({
  days,
  ends,
  units,
}: {
  days: readonly PlanDay[];
  ends: ReadonlyMap<number, Date>;
  /** Everything the run laid on the days, carried work included. */
  units: readonly ScheduledUnit[];
}): StrainedEnd[] {
  return [...ends].flatMap(([phase, date]) => {
    const day = days.find((entry) => entry.date.getTime() === date.getTime());
    const onDay = units.filter((unit) => unit.date.getTime() === date.getTime());
    const boss = onDay.find((unit) => unit.key === getBossKey(phase));

    if (!day || !boss) {
      return [];
    }

    // Lessons give way to a challenge, and a unit is due on the day it ends with all its minutes
    // (a stand-in studied over weeks): only the challenges on the day strain it.
    const capacity = getLessonCapacity(day);

    const load = onDay.reduce(
      (total, unit) => total + (unit.kind === "boss" ? unit.minutes : 0),
      0,
    );

    return !isLessonRoom(capacity) || load > Math.max(capacity, boss.minutes) + EPSILON
      ? [
          {
            phase,
            resting: day.shape.minutes <= 0,
            room: findRoomDay({ date, days, phase, units }),
          },
        ]
      : [];
  });
}

/**
 * The kept phase ends whose challenge comes before a lesson it tests: one still to do of a skill
 * of its phase or an earlier one (by the graph, wherever the plan files it) that the plan as the
 * run saves it, this week's kept items included, dates after it. A challenge held on the shown day
 * pushed them past it: a missed day left them undone, or they took longer than planned. Depth a
 * plan short on time studies once every core is in may come after. A missed day's settling lets
 * these ends go, so each challenge comes after its lessons (see `computeSettledPlan`), and Today
 * offers to move them on other days (see `planPhaseDatesMove`). A challenge the learner won comes
 * before none of them.
 */
export function listEndsBeforeLessons({
  ends,
  input,
  items,
  units,
}: {
  ends: ReadonlyMap<number, Date>;
  /** The run's input, whose graph says each skill's phase. */
  input: Pick<BuildPlanInput, "graph">;
  /** The plan as the run saves it. */
  items: readonly Pick<
    PlannedItem,
    "key" | "kind" | "phase" | "scheduledFor" | "skillId" | "status"
  >[];
  /** The run's own units, which say which lessons are only depth. */
  units: readonly Pick<ScheduledUnit, "depth" | "key">[];
}): number[] {
  const phaseOf = new Map(input.graph.skills.map((skill) => [skill.skillId, skill.phase]));
  const core = new Set(units.flatMap((unit) => (unit.depth ? [] : [unit.key])));

  const depth = new Set(
    units.flatMap((unit) => (unit.depth && !core.has(unit.key) ? [unit.key] : [])),
  );

  const lessons = items.filter(
    (item) =>
      LEARN_KINDS.has(item.kind) &&
      item.status === "todo" &&
      item.scheduledFor !== null &&
      !depth.has(item.key),
  );

  const won = listWonPhases(items);

  return [...ends].flatMap(([phase, date]) =>
    !won.has(phase) &&
    lessons.some(
      (item) =>
        (phaseOf.get(item.skillId ?? "") ?? item.phase) <= phase &&
        item.scheduledFor !== null &&
        item.scheduledFor > date,
    )
      ? [phase]
      : [],
  );
}

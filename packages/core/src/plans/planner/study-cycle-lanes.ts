import { type QueueUnit } from "./plan-units";
import { type PlanDay, getLessonCapacity } from "./schedule-units";

/**
 * How many subjects one study day covers, by its minutes: one for a few minutes, two for up to an
 * hour, three for up to two and a half hours and four for longer days. Enough to keep every subject
 * coming back within days, few enough that each gets a real block of study.
 */
const SUBJECTS_BY_DAY_MINUTES = [
  { maxMinutes: 20, subjects: 1 },
  { maxMinutes: 60, subjects: 2 },
  { maxMinutes: 150, subjects: 3 },
] as const;

const LONG_DAY_SUBJECTS = 4;

/** An area that is worth nothing right now still gets its turn, last. */
const MIN_RATE = 1e-6;

/**
 * Subjects whose first skill sits in a later phase of the teaching order join the cycle later:
 * the last phase's within this many study days, or a quarter of a shorter plan's. The foundations
 * start alone, and everything is under way within two weeks.
 */
const MAX_JOIN_DAYS = 14;
const JOIN_SHARE = 0.25;

export function getSubjectsPerDay(minutes: number): number {
  return (
    SUBJECTS_BY_DAY_MINUTES.find((step) => minutes <= step.maxMinutes)?.subjects ??
    LONG_DAY_SUBJECTS
  );
}

/**
 * One subject of the cycle: its units still to place, in teaching order, and its `pass`, the time
 * it has had so far divided by what it's worth (stride scheduling): the lowest goes next.
 */
export type Lane = {
  area: string;
  /** The study day (counted among days with lesson time) it joins the cycle on. */
  joinDay: number;
  order: number;
  pass: number;
  rate: number;
  units: QueueUnit[];
};

/**
 * An area practiced on days of its own instead of in the cycle's rotation: a written test the
 * learner practices every other week or only in the final weeks. It gets as many lesson minutes
 * as it would in the rotation (`minutes`), spread evenly over its days.
 */
export type CadencedArea = {
  minutes: number;
  /** The days (indexes into the plan's days) it's practiced on. */
  openDays: ReadonlySet<number>;
};

/** A cadenced area's lane: its units, its days and the minutes it has left to place. */
export type CadencedLane = Lane & {
  /** Lesson minutes of its days from each day on, so each day takes its even part of what's left. */
  openLeft: readonly number[];
  openDays: ReadonlySet<number>;
  quota: number;
};

export type CycleState = {
  /** Areas practiced on their own days (see `CadencedArea`), apart from the rotation. */
  cadenced: CadencedLane[];
  /** The day before ended with time no lesson fitted in: the next unit opens a new day. */
  closedDay: boolean;
  /** A whole day went by without lessons: the next unit says where it starts. */
  skippedDay: boolean;
  lanes: Lane[];
  /** Days with lesson time the cycle has filled. */
  studyDay: number;
  /** Units still to place per skill: a skill is placed once none are left. */
  left: Map<string, number>;
  placed: QueueUnit[];
  /** Lesson minutes placed so far, as `scheduleUnits` adds them up. */
  used: number;
};

export type CycleContext = {
  /** The subject each skill is taught in. */
  areas: ReadonlyMap<string, string>;
  /** Lesson minutes the days offer, added up day by day. */
  cumulative: readonly number[];
  days: readonly PlanDay[];
  prerequisites: ReadonlyMap<string, readonly string[]>;
};

/** How many study days the plan has, which sets how late the last subjects join. */
export function getJoinWindow(days: readonly PlanDay[]): number {
  const studyDays = days.filter((day) => getLessonCapacity(day) > 0).length;
  return Math.min(MAX_JOIN_DAYS, studyDays * JOIN_SHARE);
}

/**
 * A subject's units in teaching order, except that each comes after the units of the skills it
 * builds on in the same subject (what they build on first). A chapter shared by several skills is
 * planned where its first skill is taught, while its later lessons count for a later skill, which
 * can build on a skill the subject reaches after that chapter: in the queue's order the subject
 * would wait on its own later lessons, and a subject that waits loses its days to the others. A
 * prerequisite cycle the graph normalizer missed keeps the teaching order.
 */
export function orderOwnPrerequisites({
  prerequisites,
  units,
}: {
  prerequisites: ReadonlyMap<string, readonly string[]>;
  units: readonly QueueUnit[];
}): QueueUnit[] {
  // A skill's depth comes after every core (`putCoresFirst`), and what builds on it needs only its core.
  const cores = Map.groupBy(
    units.filter((unit) => unit.skillId && !unit.depth),
    (unit) => unit.skillId ?? "",
  );

  const pending = new Set(units);
  const visiting = new Set<string>();
  const ordered: QueueUnit[] = [];

  const placeSkill = (skillId: string): void => {
    if (!visiting.has(skillId)) {
      (cores.get(skillId) ?? []).forEach((unit) => place(unit));
    }
  };

  const place = (unit: QueueUnit): void => {
    const { skillId } = unit;

    if (!pending.has(unit)) {
      return;
    }

    if (skillId && !visiting.has(skillId)) {
      visiting.add(skillId);
      (prerequisites.get(skillId) ?? []).forEach((id) => placeSkill(id));
      visiting.delete(skillId);
    }

    if (pending.delete(unit)) {
      ordered.push(unit);
    }
  };

  units.forEach((unit) => place(unit));

  return ordered;
}

/**
 * Where an area opens the cycle after the gaps: the notice's parts the learner didn't say they
 * know, then the ones they did (they start past the basics anyway), then areas beyond the notice
 * (exam strategy), which the exam doesn't score. Without a notice every area is a part.
 */
function getOpeningGroup({
  area,
  knownAreas,
  noticeAreas,
}: {
  area: string;
  knownAreas: ReadonlySet<string>;
  noticeAreas: ReadonlySet<string> | null;
}): number {
  if (noticeAreas && !noticeAreas.has(area)) {
    return 2;
  }

  return knownAreas.has(area) ? 1 : 0;
}

/**
 * The subjects in the order the cycle takes them when they're even (the first days): the ones
 * placement found gaps in first; then the notice's parts the learner didn't say they know, the
 * ones they did and what's beyond the notice (`getOpeningGroup`); within each, the ones worth most
 * to the learner (the exam's weight for their course and their gaps), then the teaching order. The
 * cuts of a plan short on time agree: gaps stay first and what the learner knows goes first (see
 * `rankCores`). A learner who just showed they don't know English yet sees it on day one, and one
 * who said they know Linguagens and Matemática starts with Natureza and Humanas, not with them.
 */
function orderAreas({
  firstAreas,
  knownAreas,
  noticeAreas,
  rates,
  units,
}: {
  firstAreas: ReadonlySet<string>;
  knownAreas: ReadonlySet<string>;
  noticeAreas: ReadonlySet<string> | null;
  rates: ReadonlyMap<string, number>;
  units: readonly QueueUnit[];
}): string[] {
  const areas = [...new Set(units.map((unit) => unit.area))];
  const group = (area: string) => getOpeningGroup({ area, knownAreas, noticeAreas });

  return areas.toSorted(
    (a, b) =>
      Number(firstAreas.has(b)) - Number(firstAreas.has(a)) ||
      group(a) - group(b) ||
      (rates.get(b) ?? 1) - (rates.get(a) ?? 1) ||
      areas.indexOf(a) - areas.indexOf(b),
  );
}

export function toLanes({
  areaPhases = new Map(),
  firstAreas = new Set(),
  joinWindow,
  knownAreas = new Set(),
  noticeAreas = null,
  prerequisites,
  rates,
  units,
}: {
  /**
   * The phase each area starts in the skill graph. An area whose foundations the learner skipped
   * still joins at its own start, not at the phase of the lessons it has left.
   */
  areaPhases?: ReadonlyMap<string, number>;
  /** The subjects placement found gaps in: they open the cycle. */
  firstAreas?: ReadonlySet<string>;
  joinWindow: number;
  /** The notice's parts the learner said they know: they open it after the others. */
  knownAreas?: ReadonlySet<string>;
  /** The notice's parts, before areas beyond it; null without a notice. */
  noticeAreas?: ReadonlySet<string> | null;
  prerequisites: ReadonlyMap<string, readonly string[]>;
  rates: ReadonlyMap<string, number>;
  units: readonly QueueUnit[];
}): Lane[] {
  const areas = orderAreas({ firstAreas, knownAreas, noticeAreas, rates, units });
  const phases = units.map((unit) => unit.phase);
  const first = Math.min(...phases);
  const last = Math.max(...phases);

  return areas.map((area, order) => {
    const own = units.filter((unit) => unit.area === area);

    const phase = Math.max(
      first,
      Math.min(areaPhases.get(area) ?? Infinity, ...own.map((unit) => unit.phase)),
    );

    return {
      area,
      joinDay: last > first ? Math.round(((phase - first) / (last - first)) * joinWindow) : 0,
      order,
      pass: 0,
      rate: Math.max(MIN_RATE, rates.get(area) ?? 1),
      units: orderOwnPrerequisites({ prerequisites, units: own }),
    };
  });
}

/**
 * Units still to place per skill, its core alone (a skill's depth comes after every core, and
 * what builds on it needs only its core).
 */
export function countBySkill(units: readonly QueueUnit[]): Map<string, number> {
  return units.reduce((counts, unit) => {
    if (unit.skillId && !unit.depth) {
      counts.set(unit.skillId, (counts.get(unit.skillId) ?? 0) + 1);
    }

    return counts;
  }, new Map<string, number>());
}

function isSameSubject({
  context,
  prerequisiteId,
  skillId,
}: {
  context: CycleContext;
  prerequisiteId: string;
  skillId: string;
}): boolean {
  return context.areas.get(prerequisiteId) === context.areas.get(skillId);
}

/** A unit can go once its skill's prerequisites in its own subject are placed. */
export function isUnitReady({
  context,
  left,
  unit,
}: {
  context: CycleContext;
  left: ReadonlyMap<string, number>;
  unit: QueueUnit | undefined;
}): boolean {
  const skillId = unit?.skillId;

  if (!skillId) {
    return true;
  }

  // Another subject's prerequisites don't hold a skill back: the subjects of a cycle move side by
  // side, and the ones a subject needs are brought forward when it joins (`pullPrerequisites`).
  return (context.prerequisites.get(skillId) ?? []).every(
    (id) =>
      id === skillId ||
      !isSameSubject({ context, prerequisiteId: id, skillId }) ||
      (left.get(id) ?? 0) === 0,
  );
}

/**
 * The skills not placed yet that a skill needs, and what they need in turn. A cycle the graph
 * normalizer missed stops the walk.
 */
function listUnmetPrerequisites({
  context,
  left,
  seen = new Set<string>(),
  skillId,
}: {
  context: CycleContext;
  left: ReadonlyMap<string, number>;
  seen?: Set<string>;
  skillId: string;
}): Set<string> {
  const unmet = (context.prerequisites.get(skillId) ?? []).filter(
    (id) => id !== skillId && !seen.has(id) && (left.get(id) ?? 0) > 0,
  );

  unmet.forEach((id) => {
    seen.add(id);
    listUnmetPrerequisites({ context, left, seen, skillId: id });
  });

  return seen;
}

/**
 * Brings forward, in their own subjects, the skills from other subjects that a subject in the
 * cycle builds on, with what they need in turn: the discursive test that builds on official
 * writing and parliamentary procedure gets them taught next instead of waiting for whole subjects
 * to get there, which a short plan never would. A skill that opens another subject is worth what
 * that subject is, so time goes to it before the rest of its own subject. The skills brought
 * forward keep their subject's order among themselves, so each still follows what it needs.
 */
export function pullPrerequisites({
  context,
  lane,
  lanes,
  left,
}: {
  context: CycleContext;
  lane: Lane;
  lanes: readonly Lane[];
  left: ReadonlyMap<string, number>;
}): void {
  const skillId = lane.units[0]?.skillId;

  if (!skillId) {
    return;
  }

  const needed = listUnmetPrerequisites({ context, left, skillId });
  const isNeeded = (unit: QueueUnit) => unit.skillId !== null && needed.has(unit.skillId);

  // The subject's own lane too: its units already follow what they build on (`toLanes`), so this
  // only moves forward what the head needs, in the order it was in.
  lanes
    .filter((other) => other.units.some((unit) => isNeeded(unit)))
    .forEach((other) => {
      other.units = [
        ...other.units.filter((unit) => isNeeded(unit)),
        ...other.units.filter((unit) => !isNeeded(unit)),
      ];
    });
}

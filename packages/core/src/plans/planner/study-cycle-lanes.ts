import { type QueueUnit } from "./plan-units";
import { type PlanDay, getLessonCapacity } from "./schedule-units";

const SUBJECTS_BY_DAY_MINUTES = [
  { maxMinutes: 20, subjects: 1 },
  { maxMinutes: 60, subjects: 2 },
  { maxMinutes: 150, subjects: 3 },
] as const;

const LONG_DAY_SUBJECTS = 4;

/** Above zero, so an area worth nothing now still gets its turn, last. */
const MIN_RATE = 1e-6;

const MAX_JOIN_DAYS = 14;
const JOIN_SHARE = 0.25;

export function getSubjectsPerDay(minutes: number): number {
  return (
    SUBJECTS_BY_DAY_MINUTES.find((step) => minutes <= step.maxMinutes)?.subjects ??
    LONG_DAY_SUBJECTS
  );
}

/** `pass` is time had over worth (stride scheduling): the lowest goes next. */
export type Lane = {
  area: string;
  /** Due markers keep their references while the pending units are reordered or removed. */
  dueUnits: readonly QueueUnit[];
  joinDay: number;
  order: number;
  pass: number;
  rate: number;
  units: QueueUnit[];
};

export type CadencedArea = { minutes: number; openDays: ReadonlySet<number> };

export type CadencedLane = Lane & {
  minutes: number;
  openLeft: readonly number[];
  openDays: ReadonlySet<number>;
  quota: number;
};

export type CycleState = {
  cadenced: CadencedLane[];
  closedDay: boolean;
  skippedDay: boolean;
  lanes: Lane[];
  studyDay: number;
  left: Map<string, number>;
  placed: QueueUnit[];
  used: number;
};

export type CycleContext = {
  areas: ReadonlyMap<string, string>;
  counts: ReadonlyMap<string, number>;
  cumulative: readonly number[];
  days: readonly PlanDay[];
  prerequisites: ReadonlyMap<string, readonly string[]>;
};

export function getJoinWindow(days: readonly PlanDay[]): number {
  const studyDays = days.filter((day) => getLessonCapacity(day) > 0).length;
  return Math.min(MAX_JOIN_DAYS, studyDays * JOIN_SHARE);
}

function isOwnCore(unit: QueueUnit): boolean {
  return Boolean(unit.skillId && !unit.depth);
}

export function orderOwnPrerequisites({
  prerequisites,
  units,
}: {
  prerequisites: ReadonlyMap<string, readonly string[]>;
  units: readonly QueueUnit[];
}): QueueUnit[] {
  const cores = Map.groupBy(
    units.filter((unit) => isOwnCore(unit)),
    (unit) => unit.skillId ?? "",
  );

  const pending = new Set(units);
  const visiting = new Set<string>();
  const ordered: QueueUnit[] = [];

  const coresLeft = new Map([...cores].map(([skillId, own]) => [skillId, own.length]));

  const placeSkill = (skillId: string): void => {
    if (!visiting.has(skillId) && (coresLeft.get(skillId) ?? 0) > 0) {
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

    if (!pending.delete(unit)) {
      return;
    }

    ordered.push(unit);

    if (isOwnCore(unit) && skillId) {
      coresLeft.set(skillId, (coresLeft.get(skillId) ?? 0) - 1);
    }
  };

  units.forEach((unit) => place(unit));

  return ordered;
}

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
  areaPhases?: ReadonlyMap<string, number>;
  firstAreas?: ReadonlySet<string>;
  joinWindow: number;
  knownAreas?: ReadonlySet<string>;
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
      dueUnits: own.filter((unit) => unit.dueBy),
      joinDay: last > first ? Math.round(((phase - first) / (last - first)) * joinWindow) : 0,
      order,
      pass: 0,
      rate: Math.max(MIN_RATE, rates.get(area) ?? 1),
      units: orderOwnPrerequisites({ prerequisites, units: own }),
    };
  });
}

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

  return (context.prerequisites.get(skillId) ?? []).every((id) => {
    const toPlace = left.get(id) ?? 0;

    return (
      id === skillId ||
      toPlace === 0 ||
      (!isSameSubject({ context, prerequisiteId: id, skillId }) &&
        toPlace < (context.counts.get(id) ?? 0))
    );
  });
}

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

  if (needed.size === 0) {
    return;
  }

  const isNeeded = (unit: QueueUnit) =>
    unit.skillId !== null && needed.has(unit.skillId) && !unit.rankedOut;

  lanes
    .filter((other) => other.units.some((unit) => isNeeded(unit)))
    .forEach((other) => {
      other.units = [
        ...other.units.filter((unit) => isNeeded(unit)),
        ...other.units.filter((unit) => !isNeeded(unit)),
      ];
    });
}

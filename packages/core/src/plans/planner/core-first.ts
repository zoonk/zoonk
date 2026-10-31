import { type PlanGraph } from "./plan-state";
import { type QueueUnit } from "./plan-units";

const CORE_SHARE = 1 / 3;

export function getCoreLessons(lessons: number): number {
  return Math.max(1, Math.ceil(lessons * CORE_SHARE));
}

function countLessons(unit: QueueUnit): number {
  return unit.lessonId ? 1 : (unit.lessons ?? 1);
}

export function countSkillLessons(units: readonly QueueUnit[]): Map<string, number> {
  return units.reduce((totals, unit) => {
    if (unit.kind !== "lesson" || !unit.skillId) {
      return totals;
    }

    return totals.set(unit.skillId, (totals.get(unit.skillId) ?? 0) + countLessons(unit));
  }, new Map<string, number>());
}

export function withPlannedLessons({
  graph,
  skillLessons,
}: {
  graph: PlanGraph;
  skillLessons: ReadonlyMap<string, number>;
}): PlanGraph {
  return {
    ...graph,
    skills: graph.skills.map((skill) => ({
      ...skill,
      plannedLessons: skillLessons.get(skill.skillId) ?? 0,
    })),
  };
}

/** A run that read the last build's counts would take them for something new. */
export function withoutPlannedLessons(graph: PlanGraph): PlanGraph {
  return {
    ...graph,
    skills: graph.skills.map((skill) => ({ ...skill, plannedLessons: undefined })),
  };
}

function splitStandIn({ core, unit }: { core: number; unit: QueueUnit }): QueueUnit[] {
  const lessons = countLessons(unit);
  const perLesson = unit.minutes / lessons;

  return [
    { ...unit, lessons: core, minutes: perLesson * core },
    { ...unit, depth: true, lessons: lessons - core, minutes: perLesson * (lessons - core) },
  ];
}

export function splitClosing(units: readonly QueueUnit[]): {
  closing: QueueUnit | null;
  rest: QueueUnit[];
} {
  const last = units.at(-1);
  const closing = last?.kind === "boss" ? last : null;

  return { closing, rest: closing ? units.slice(0, -1) : [...units] };
}

function sumMinutes(units: readonly QueueUnit[]): number {
  return units.reduce((total, unit) => total + unit.minutes, 0);
}

function interleaveByArea({
  askedOf,
  ranks,
  units,
}: {
  askedOf: (skillId: string | null) => number;
  ranks: ReadonlyMap<string, number>;
  units: readonly QueueUnit[];
}): QueueUnit[] {
  const rankOf = (unit: QueueUnit) => (unit.skillId ? (ranks.get(unit.skillId) ?? 0) : 0);

  const byArea = new Map(
    [...Map.groupBy(units, (unit) => unit.area)].map(([area, own]) => [
      area,
      own.toSorted((a, b) => askedOf(b.skillId) - askedOf(a.skillId) || rankOf(b) - rankOf(a)),
    ]),
  );

  const areas = [...byArea.keys()];
  const totals = new Map(areas.map((area) => [area, sumMinutes(byArea.get(area) ?? []) || 1]));
  const taken = new Map(areas.map((area) => [area, { count: 0, minutes: 0 }]));
  const share = (area: string) => (taken.get(area)?.minutes ?? 0) / (totals.get(area) ?? 1);

  return units.flatMap(() => {
    const open = areas.filter(
      (area) => (taken.get(area)?.count ?? 0) < (byArea.get(area)?.length ?? 0),
    );

    const [first] = open;

    if (first === undefined) {
      return [];
    }

    const area = open.reduce((best, next) => (share(next) < share(best) ? next : best), first);
    const progress = taken.get(area);
    const unit = byArea.get(area)?.[progress?.count ?? 0];

    if (!unit || !progress) {
      return [];
    }

    progress.count += 1;
    progress.minutes += unit.minutes;
    return [unit];
  });
}

export function putCoresFirst(
  units: readonly QueueUnit[],
  {
    askedOf = () => 0,
    kept = new Map(),
    ranks = new Map(),
    wholeOutcomes = true,
  }: {
    askedOf?: (skillId: string | null) => number;
    kept?: ReadonlyMap<string, number>;
    ranks?: ReadonlyMap<string, number>;
    wholeOutcomes?: boolean;
  } = {},
): QueueUnit[] {
  const pending = countSkillLessons(units);

  const totals = new Map(
    [...pending].map(([skillId, lessons]) => [skillId, lessons + (kept.get(skillId) ?? 0)]),
  );

  const taken = new Map(kept);

  const parts = units.flatMap((unit) => {
    const { skillId } = unit;

    if (
      unit.kind !== "lesson" ||
      !skillId ||
      (unit.outcome && wholeOutcomes) ||
      unit.announced ||
      unit.depth
    ) {
      return [unit];
    }

    const lessons = countLessons(unit);
    const before = taken.get(skillId) ?? 0;
    const left = getCoreLessons(totals.get(skillId) ?? 1) - before;
    const core = unit.inProgress || unit.coreOnly ? lessons : Math.max(0, Math.min(lessons, left));
    taken.set(skillId, before + lessons);

    if (core === lessons) {
      return [unit];
    }

    return core === 0 ? [{ ...unit, depth: true }] : splitStandIn({ core, unit });
  });

  const { closing, rest } = splitClosing(parts);

  return [
    ...rest.filter((unit) => !unit.depth),
    ...interleaveByArea({
      askedOf,
      ranks,
      units: rest.filter((unit) => unit.depth && unit.focused),
    }),
    ...interleaveByArea({
      askedOf,
      ranks,
      units: rest.filter((unit) => unit.depth && !unit.focused && !unit.reduced),
    }),
    ...interleaveByArea({
      askedOf,
      ranks,
      units: rest.filter((unit) => unit.depth && unit.reduced),
    }),
    ...(closing ? [closing] : []),
  ];
}

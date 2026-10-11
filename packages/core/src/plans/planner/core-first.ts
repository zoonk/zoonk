import { type PlanGraph } from "./plan-state";
import { type QueueUnit } from "./plan-units";

/**
 * A skill's core is its first third of lessons, at least one: what a learner needs to have studied
 * the topic at all. The rest is depth.
 */
const CORE_SHARE = 1 / 3;

export function getCoreLessons(lessons: number): number {
  return Math.max(1, Math.ceil(lessons * CORE_SHARE));
}

function countLessons(unit: QueueUnit): number {
  return unit.lessonId ? 1 : (unit.lessons ?? 1);
}

/** Each skill's lessons in the plan, its stand-ins counted as the lessons they plan. */
export function countSkillLessons(units: readonly QueueUnit[]): Map<string, number> {
  return units.reduce((totals, unit) => {
    if (unit.kind !== "lesson" || !unit.skillId) {
      return totals;
    }

    return totals.set(unit.skillId, (totals.get(unit.skillId) ?? 0) + countLessons(unit));
  }, new Map<string, number>());
}

/**
 * The graph as the plan saves it: each skill with the lessons this build counted for it
 * (`countSkillLessons`, before any cut), none for a skill it planned no lesson of. A skill's core
 * is the first third of them, the same for the plan, its challenges and its checks.
 */
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

/**
 * The graph as a planning run reads it: without the lessons the last build counted
 * (`withPlannedLessons`), which every run counts again from its own queue. A run that read them
 * would take the last build's counts for something new.
 */
export function withoutPlannedLessons(graph: PlanGraph): PlanGraph {
  return {
    ...graph,
    skills: graph.skills.map((skill) => ({ ...skill, plannedLessons: undefined })),
  };
}

/** A stand-in that spans the end of its skill's core, as its core part and its depth part. */
function splitStandIn({ core, unit }: { core: number; unit: QueueUnit }): QueueUnit[] {
  const lessons = countLessons(unit);
  const perLesson = unit.minutes / lessons;

  return [
    { ...unit, lessons: core, minutes: perLesson * core },
    { ...unit, depth: true, lessons: lessons - core, minutes: perLesson * (lessons - core) },
  ];
}

/** The checkpoint that closes the plan, which stays last, apart from the units before it. */
export function splitClosing(units: readonly QueueUnit[]): {
  closing: QueueUnit | null;
  rest: QueueUnit[];
} {
  const last = units.at(-1);
  const closing = last?.kind === "boss" ? last : null;

  return { closing, rest: closing ? units.slice(0, -1) : [...units] };
}

/** Minutes a list of units takes. */
function sumMinutes(units: readonly QueueUnit[]): number {
  return units.reduce((total, unit) => total + unit.minutes, 0);
}

/**
 * Depth from every area in turn, each area's in its own order, so the areas go through their
 * depth at the same pace (the share of its depth minutes each has had): a plan cut short keeps
 * the same share of every area's depth instead of all of the first areas' and none of the last
 * ones'. In the queue's order, a career change's research depth ran until February of a
 * six-month plan while prototyping and testing, later in the path, lost most of theirs.
 */
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

  // Inside an area, the depth of the topics the exam asks most first, then of the skills worth
  // most, so a plan cut short cuts the depth of the least asked first.
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

/**
 * The plan's units with every skill's core first and its depth after (each marked `depth`), the
 * cores in the queue's order and the depth of every area in turn (see `interleaveByArea`), the
 * depth of the areas the learner focused on before the rest, and of the ones they want less of
 * after it: what a plan short on time studies,
 * so every topic (and every module) is in it, the ones worth more (or
 * picked) with more depth, and only when even the cores don't fit do the last ones wait. A phase
 * checkpoint stays after its phase's cores, except the one that closes the plan, which still
 * closes it. With `wholeOutcomes`, an outcome skill (a career change's portfolio and job search,
 * which get the learner the job) is all core, so it stays whole. An exam's outcome skills (its
 * written test: ENEM's essay, a discursive test) keep their core like every topic and get depth in
 * proportion to what they're worth, like the exam's other parts: kept whole, ENEM's essay, one of
 * five parts of the score, took most of a month-long plan's days. A lesson on what the class test
 * announces (`QueueUnit.announced`) is core, so a plan short on time keeps it with its skill, and
 * so is the rest of the chapter the learner is in the middle of (`QueueUnit.inProgress`), so a
 * re-plan never sends it after other skills' cores.
 */
export function putCoresFirst(
  units: readonly QueueUnit[],
  {
    askedOf = () => 0,
    kept = new Map(),
    ranks = new Map(),
    wholeOutcomes = true,
  }: {
    /**
     * How often the exam asks each skill's topics (see `getAskedScore`): an area's depth of the
     * topics asked most comes first, so the cut takes the least asked's first. Absent for goals
     * that aren't exams with a notice: each area's depth then follows `ranks`.
     */
    askedOf?: (skillId: string | null) => number;
    /**
     * Each skill's lessons the plan already holds outside `units` (done, or kept this week): they
     * come first in its teaching order and count toward its core, so a re-plan never asks a skill
     * that has its core for another third of what's left while untouched skills wait.
     */
    kept?: ReadonlyMap<string, number>;
    /**
     * What each skill is worth to the goal (see `buildPlanQueue`): inside an area, the depth of the
     * skills worth most comes first. Without them, each area's depth keeps the queue's order.
     */
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

    // A lesson on what the class test announces is core too, wherever its skill teaches it:
    // Pedro's plan cut the osmosis lesson his teacher announced an essay on, his skill's third.
    // A skill beyond the notice that nothing builds on is depth already (see `putBeyondNoticeLast`).
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
    // The rest of the chapter the learner is in is core, and counts toward its skill's core.
    const core = unit.inProgress ? lessons : Math.max(0, Math.min(lessons, left));
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

import { type QueueUnit } from "./plan-units";

/**
 * A skill's core is its first third of lessons, at least one: what a learner needs to have studied
 * the topic at all. The rest is depth.
 */
const CORE_SHARE = 1 / 3;

function getCoreLessons(lessons: number): number {
  return Math.max(1, Math.ceil(lessons * CORE_SHARE));
}

function countLessons(unit: QueueUnit): number {
  return unit.lessonId ? 1 : (unit.lessons ?? 1);
}

/** Each skill's lessons in the plan, its stand-ins counted as the lessons they plan. */
function countSkillLessons(units: readonly QueueUnit[]): Map<string, number> {
  return units.reduce((totals, unit) => {
    if (unit.kind !== "lesson" || !unit.skillId) {
      return totals;
    }

    return totals.set(unit.skillId, (totals.get(unit.skillId) ?? 0) + countLessons(unit));
  }, new Map<string, number>());
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
function interleaveByArea(
  units: readonly QueueUnit[],
  ranks: ReadonlyMap<string, number>,
): QueueUnit[] {
  const rankOf = (unit: QueueUnit) => (unit.skillId ? (ranks.get(unit.skillId) ?? 0) : 0);

  // Inside an area, the depth of the skills worth most first, so a plan cut short keeps it.
  const byArea = new Map(
    [...Map.groupBy(units, (unit) => unit.area)].map(([area, own]) => [
      area,
      own.toSorted((a, b) => rankOf(b) - rankOf(a)),
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
 * written test: a redação, a discursive test) keep their core like every topic and get depth in
 * proportion to what they're worth, like the exam's other parts: kept whole, ENEM's redação, one of
 * five parts of the score, took most of a month-long plan's days. A lesson on what the class test
 * announces (`QueueUnit.announced`) is core, so a plan short on time keeps it with its skill.
 */
export function putCoresFirst(
  units: readonly QueueUnit[],
  {
    kept = new Map(),
    ranks = new Map(),
    wholeOutcomes = true,
  }: {
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
    if (unit.kind !== "lesson" || !skillId || (unit.outcome && wholeOutcomes) || unit.announced) {
      return [unit];
    }

    const lessons = countLessons(unit);
    const before = taken.get(skillId) ?? 0;
    const core = Math.max(0, Math.min(lessons, getCoreLessons(totals.get(skillId) ?? 1) - before));
    taken.set(skillId, before + lessons);

    if (core === lessons) {
      return [unit];
    }

    return core === 0 ? [{ ...unit, depth: true }] : splitStandIn({ core, unit });
  });

  const last = parts.at(-1);
  const closing = last?.kind === "boss" ? last : null;
  const rest = closing ? parts.slice(0, -1) : parts;

  return [
    ...rest.filter((unit) => !unit.depth),
    ...interleaveByArea(
      rest.filter((unit) => unit.depth && unit.focused),
      ranks,
    ),
    ...interleaveByArea(
      rest.filter((unit) => unit.depth && !unit.focused && !unit.reduced),
      ranks,
    ),
    ...interleaveByArea(
      rest.filter((unit) => unit.depth && unit.reduced),
      ranks,
    ),
    ...(closing ? [closing] : []),
  ];
}

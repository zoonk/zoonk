import { type MasteryState } from "@zoonk/db";

/** How much is still missing once the learner has recalled the skill, from their state on it. */
const GAP_BY_STATE: Record<Exclude<MasteryState, "new">, number> = {
  learning: 0.6,
  mastered: 0.1,
  solid: 0.3,
};

/**
 * FSRS starts a skill whose first answer was wrong or "I don't know yet" at about a fifth of a day
 * and one answered right at a day or more: under a day, the learner hasn't recalled it yet.
 */
const RECALLED_STABILITY_DAYS = 1;

/** A focused area counts double, so "focus on math" moves it up without dropping the rest. */
export const FOCUS_WEIGHT_FACTOR = 2;

/**
 * How much more a skill counts when the learner model is unsure about it: up to half again for a
 * state that rests on no reviews, such as one inferred from placement.
 */
const UNCERTAINTY_WEIGHT = 0.5;

/** What the learner model says about one skill, for exam priority. */
export type SkillReadiness = {
  /** The chance of recalling it on the exam day, or null when never studied. */
  retrievabilityAtTarget: number | null;
  /** Reviews behind the state: the fewer, the less sure the estimate. Missing counts as none. */
  reps?: number;
  /** Days the memory holds (FSRS stability). */
  stability: number;
  state: MasteryState;
};

/** From 1 with no evidence toward 0 as reviews confirm the state. */
function getUncertainty(readiness: SkillReadiness): number {
  return 1 / (1 + (readiness.reps ?? 0));
}

/**
 * What a skill is worth to the exam now: weight × gap × risk of forgetting. A skill the learner
 * hasn't recalled yet (never studied, or placement found it missing) has the whole gap and the
 * whole risk, so a gap placement confirmed ranks with the skills nobody asked about, not below
 * them. A recalled state that rests on few reviews counts more, since it may hide a gap.
 */
export function getExamValue({
  readiness,
  weight,
}: {
  readiness: SkillReadiness | undefined;
  weight: number;
}): number {
  if (!readiness || readiness.state === "new" || readiness.stability < RECALLED_STABILITY_DAYS) {
    return weight;
  }

  const gap = GAP_BY_STATE[readiness.state];
  const forgettingRisk = 1 - (readiness.retrievabilityAtTarget ?? 0);
  const uncertainty = 1 + UNCERTAINTY_WEIGHT * getUncertainty(readiness);

  return weight * gap * forgettingRisk * uncertainty;
}

/** Exam priority: time goes where it pays, a skill's value ÷ the time it needs, per minute. */
export function getExamPriority({ minutes, value }: { minutes: number; value: number }): number {
  return value / Math.max(minutes, 1);
}

function findInheritedValue({
  dependents,
  memo,
  skillId,
  values,
  visiting,
}: {
  dependents: ReadonlyMap<string, readonly string[]>;
  memo: Map<string, number>;
  skillId: string;
  values: ReadonlyMap<string, number>;
  visiting: ReadonlySet<string>;
}): number {
  const known = memo.get(skillId);

  if (known !== undefined) {
    return known;
  }

  const inside = new Set([...visiting, skillId]);

  const opened = (dependents.get(skillId) ?? [])
    .filter((dependentId) => !inside.has(dependentId))
    .map((dependentId) =>
      findInheritedValue({ dependents, memo, skillId: dependentId, values, visiting: inside }),
    );

  const value = Math.max(values.get(skillId) ?? 0, ...opened);
  memo.set(skillId, value);

  return value;
}

/**
 * A prerequisite is worth as much as the most valuable skill it opens: the exam may never ask it
 * on its own, but the skills it holds back are what the time is for. Prerequisites outside the
 * list don't count.
 */
export function inheritValues({
  prerequisites,
  values,
}: {
  prerequisites: ReadonlyMap<string, readonly string[]>;
  values: ReadonlyMap<string, number>;
}): Map<string, number> {
  const dependents = [...prerequisites].reduce((map, [skillId, required]) => {
    required
      .filter((id) => values.has(id) && values.has(skillId) && id !== skillId)
      .forEach((id) => map.set(id, [...(map.get(id) ?? []), skillId]));

    return map;
  }, new Map<string, string[]>());

  const memo = new Map<string, number>();

  return new Map(
    [...values.keys()].map((skillId) => [
      skillId,
      findInheritedValue({ dependents, memo, skillId, values, visiting: new Set() }),
    ]),
  );
}

/**
 * The prerequisites that agree with the graph's teaching order: those listed before the skill
 * they prepare for. Skills are shared, so an edge another goal's graph stored can point the other
 * way and close a cycle; followed, it would hold its skill, and every skill after it, back until
 * nothing else was left, behind later phases.
 */
export function keepTeachingOrder({
  prerequisites,
  skillIds,
}: {
  prerequisites: ReadonlyMap<string, readonly string[]>;
  /** The graph's skills in teaching order. */
  skillIds: readonly string[];
}): Map<string, string[]> {
  const positions = new Map(skillIds.map((skillId, index) => [skillId, index]));

  const isBefore = (prerequisiteId: string, skillId: string) =>
    (positions.get(prerequisiteId) ?? Infinity) < (positions.get(skillId) ?? -Infinity);

  return new Map(
    [...prerequisites].map(([skillId, required]) => [
      skillId,
      required.filter((prerequisiteId) => isBefore(prerequisiteId, skillId)),
    ]),
  );
}

function isAvailable({
  placed,
  prerequisites,
  skillId,
}: {
  placed: ReadonlySet<string>;
  prerequisites: ReadonlyMap<string, readonly string[]>;
  skillId: string;
}): boolean {
  return (prerequisites.get(skillId) ?? []).every((id) => placed.has(id));
}

function pickNext<TSkill extends { skillId: string }>({
  compare,
  placed,
  prerequisites,
  remaining,
}: {
  compare: (a: TSkill, b: TSkill) => number;
  placed: ReadonlySet<string>;
  prerequisites: ReadonlyMap<string, readonly string[]>;
  remaining: readonly TSkill[];
}): TSkill | undefined {
  const available = remaining.filter((skill) =>
    isAvailable({ placed, prerequisites, skillId: skill.skillId }),
  );

  /** A cycle the graph normalizer missed must not stall the plan: fall back to the best left. */
  return (available.length > 0 ? available : remaining).toSorted(compare)[0];
}

/**
 * Orders skills so every prerequisite comes first, choosing among the skills that are ready by
 * `compare`. Prerequisites outside the list (skipped or already known) don't hold anything back.
 */
export function orderSkills<TSkill extends { skillId: string }>({
  compare,
  prerequisites,
  skills,
}: {
  compare: (a: TSkill, b: TSkill) => number;
  prerequisites: ReadonlyMap<string, readonly string[]>;
  skills: readonly TSkill[];
}): TSkill[] {
  const ids = new Set(skills.map((skill) => skill.skillId));

  const inList = new Map(
    [...prerequisites].map(([skillId, required]) => [
      skillId,
      required.filter((id) => ids.has(id) && id !== skillId),
    ]),
  );

  return skills.reduce<{ ordered: TSkill[]; placed: Set<string> }>(
    (state) => {
      const remaining = skills.filter((skill) => !state.placed.has(skill.skillId));
      const next = pickNext({ compare, placed: state.placed, prerequisites: inList, remaining });

      return next
        ? { ordered: [...state.ordered, next], placed: new Set([...state.placed, next.skillId]) }
        : state;
    },
    { ordered: [], placed: new Set() },
  ).ordered;
}

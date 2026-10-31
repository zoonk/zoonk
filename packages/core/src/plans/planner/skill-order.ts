import { type MasteryState } from "@zoonk/db";

const GAP_BY_STATE: Record<Exclude<MasteryState, "new">, number> = {
  learning: 0.6,
  mastered: 0.1,
  solid: 0.3,
};

/**
 * FSRS starts a wrong or "I don't know yet" first answer near a fifth of a day and a right one at a
 * day or more.
 */
const RECALLED_STABILITY_DAYS = 1;

export const FOCUS_WEIGHT_FACTOR = 2;

const UNCERTAINTY_WEIGHT = 0.5;

export type SkillReadiness = {
  retrievabilityAtTarget: number | null;
  reps?: number;
  /** FSRS stability, in days. */
  stability: number;
  state: MasteryState;
};

function isRecalled(
  readiness: SkillReadiness | undefined,
): readiness is SkillReadiness & { state: Exclude<MasteryState, "new"> } {
  return (
    readiness !== undefined &&
    readiness.state !== "new" &&
    readiness.stability >= RECALLED_STABILITY_DAYS
  );
}

function getUncertainty(readiness: SkillReadiness): number {
  return 1 / (1 + (readiness.reps ?? 0));
}

export function getExamValue({
  readiness,
  weight,
}: {
  readiness: SkillReadiness | undefined;
  weight: number;
}): number {
  if (!isRecalled(readiness)) {
    return weight;
  }

  const gap = GAP_BY_STATE[readiness.state];
  const forgettingRisk = 1 - (readiness.retrievabilityAtTarget ?? 0);
  const uncertainty = 1 + UNCERTAINTY_WEIGHT * getUncertainty(readiness);

  return weight * gap * forgettingRisk * uncertainty;
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

/** Skills are shared, so another goal's graph can store an edge the other way and close a cycle. */
export function keepTeachingOrder({
  prerequisites,
  skillIds,
}: {
  prerequisites: ReadonlyMap<string, readonly string[]>;
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
}): TSkill | null {
  const available = remaining.filter((skill) =>
    isAvailable({ placed, prerequisites, skillId: skill.skillId }),
  );

  /** A cycle the graph normalizer missed must not stall the plan: fall back to the best left. */
  const pool = available.length > 0 ? available : remaining;

  return pool.reduce<TSkill | null>(
    (best, skill) => (best === null || compare(skill, best) < 0 ? skill : best),
    null,
  );
}

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

  // Grown in place: copying both per skill cost a real-size exam a twentieth of each build.
  const placed = new Set<string>();
  const ordered: TSkill[] = [];

  skills.forEach(() => {
    const remaining = skills.filter((skill) => !placed.has(skill.skillId));
    const next = pickNext({ compare, placed, prerequisites: inList, remaining });

    if (next) {
      ordered.push(next);
      placed.add(next.skillId);
    }
  });

  return ordered;
}

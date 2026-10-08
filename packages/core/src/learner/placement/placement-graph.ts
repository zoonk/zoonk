import { type CourseLevel } from "@zoonk/db";

/** Library bands from the most basic up: a subject's overview comes before its beginner skills. */
const BAND_RANK: Readonly<Record<CourseLevel, number>> = {
  advanced: 3,
  beginner: 1,
  intermediate: 2,
  overview: 0,
};

/** How basic a band is, 0 for the overview; lower bands come first in a subject. */
export function getBandRank(band: CourseLevel): number {
  return BAND_RANK[band];
}

/** One skill of a goal's plan as placement walks it. */
export type PlacementSkill = {
  /**
   * The Library band the skill graph put the skill in (overview, beginner, intermediate or
   * advanced): how basic it is within its subject. Null or absent when unknown.
   */
  band?: CourseLevel | null;
  /**
   * One of its subject's foundations (`getFoundationSkillIds`): what the subject's later skills
   * build on. Knowing the subject, or its later skills, says these are known too.
   */
  foundation?: boolean;
  id: string;
  /** The plan phase (0-based) the skill belongs to. */
  phase: number;
  /** Position across the whole plan: lower is learned earlier. */
  order: number;
  /** Prerequisites inside this graph; edges to skills outside the goal are ignored. */
  prerequisiteIds: readonly string[];
  /**
   * The area the skill graph put the skill in: the course it belongs to, such as an exam's
   * subject ("História"). Null when the graph names none. Placement places each area on its own.
   */
  sectionTitle: string | null;
};

export type SkillGraph = {
  byId: ReadonlyMap<string, PlacementSkill>;
  dependents: ReadonlyMap<string, readonly string[]>;
  /** Skills sorted by plan order, the order placement walks. */
  ordered: readonly PlacementSkill[];
};

/** Indexes a goal's skills by id, plan order and reverse (dependent) edges. */
export function buildSkillGraph(skills: readonly PlacementSkill[]): SkillGraph {
  const byId = new Map(skills.map((skill) => [skill.id, skill]));

  const dependents = skills.reduce((map, skill) => {
    skill.prerequisiteIds
      .filter((prerequisiteId) => byId.has(prerequisiteId))
      .forEach((prerequisiteId) => {
        map.set(prerequisiteId, [...(map.get(prerequisiteId) ?? []), skill.id]);
      });

    return map;
  }, new Map<string, string[]>());

  return {
    byId,
    dependents,
    ordered: skills.toSorted((a, b) => a.order - b.order || a.id.localeCompare(b.id)),
  };
}

function getNeighbors({
  direction,
  graph,
  skillId,
}: {
  direction: "dependents" | "prerequisites";
  graph: SkillGraph;
  skillId: string;
}): readonly string[] {
  if (direction === "dependents") {
    return graph.dependents.get(skillId) ?? [];
  }

  return (graph.byId.get(skillId)?.prerequisiteIds ?? []).filter((id) => graph.byId.has(id));
}

/**
 * Every skill reachable from `skillId` in one direction: all prerequisites (what the skill builds
 * on) or all dependents (what builds on it). The skill itself is not included.
 */
export function collectRelated({
  direction,
  graph,
  skillId,
}: {
  direction: "dependents" | "prerequisites";
  graph: SkillGraph;
  skillId: string;
}): Set<string> {
  const visit = (pending: readonly string[], seen: ReadonlySet<string>): Set<string> => {
    const next = pending
      .flatMap((id) => getNeighbors({ direction, graph, skillId: id }))
      .filter((id) => !seen.has(id) && id !== skillId);

    if (next.length === 0) {
      return new Set(seen);
    }

    return visit([...new Set(next)], new Set([...seen, ...next]));
  };

  return visit([skillId], new Set());
}

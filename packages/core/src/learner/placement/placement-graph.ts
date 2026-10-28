import { type CourseLevel } from "@zoonk/db";

const BAND_RANK: Readonly<Record<CourseLevel, number>> = {
  advanced: 3,
  beginner: 1,
  intermediate: 2,
  overview: 0,
};

/** Overview is zero; lower ranks are more basic. */
export function getBandRank(band: CourseLevel): number {
  return BAND_RANK[band];
}

export type PlacementSkill = {
  /** Null or omitted means the Library band is unknown. */
  band?: CourseLevel | null;
  /** A subject's later skills build on these foundations. */
  foundation?: boolean;
  id: string;
  /** The plan phase (0-based) the skill belongs to. */
  phase: number;
  /** Position across the whole plan: lower is learned earlier. */
  order: number;
  /** Ignore prerequisite edges outside this goal. */
  prerequisiteIds: readonly string[];
  /** The graph's subject, not a chapter; null when none is named. */
  sectionTitle: string | null;
};

export type SkillGraph = {
  byId: ReadonlyMap<string, PlacementSkill>;
  dependents: ReadonlyMap<string, readonly string[]>;
  /** Skills sorted by plan order, the order placement walks. */
  ordered: readonly PlacementSkill[];
};

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

/** Excludes skillId itself. */
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

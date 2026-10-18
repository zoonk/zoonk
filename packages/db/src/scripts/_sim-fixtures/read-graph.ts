import { type Prisma } from "../../generated/prisma/client";

type JsonValue = Prisma.JsonValue;

export type GraphSkill = {
  area: string | null;
  courseIds?: string[];
  lessons: number;
  name: string;
  outcome?: boolean;
  phase: number;
  skillId: string;
  topics?: string[];
  weight: number | null;
};

export type Graph = { phases: { milestone: string | null; name: string }[]; skills: GraphSkill[] };

type JsonRecord = Record<string, JsonValue | undefined>;

function isRecord(value: JsonValue | undefined): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readList(value: JsonValue | undefined): JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function readText(value: JsonValue | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function readNumber(value: JsonValue | undefined): number | null {
  return typeof value === "number" ? value : null;
}

function readTexts(value: JsonValue | undefined): string[] | undefined {
  return Array.isArray(value)
    ? value.flatMap((entry) => (typeof entry === "string" ? [entry] : []))
    : undefined;
}

function readSkill(value: JsonValue): GraphSkill[] {
  if (!isRecord(value)) {
    return [];
  }

  const skillId = readText(value.skillId);
  const courseIds = readTexts(value.courseIds);
  const topics = readTexts(value.topics);

  return skillId
    ? [
        {
          area: readText(value.area),
          ...(courseIds && { courseIds }),
          lessons: readNumber(value.lessons) ?? 1,
          name: readText(value.name) ?? skillId,
          ...(value.outcome === true && { outcome: true }),
          phase: readNumber(value.phase) ?? 0,
          skillId,
          ...(topics && { topics }),
          weight: readNumber(value.weight),
        },
      ]
    : [];
}

/** A stored plan graph (`PlanGraph`), as the planner reads it. */
export function readGraph(value: JsonValue | undefined): Graph {
  const graph = isRecord(value) ? value : {};

  const phases = readList(graph.phases).flatMap((phase) =>
    isRecord(phase)
      ? [{ milestone: readText(phase.milestone), name: readText(phase.name) ?? "" }]
      : [],
  );

  return { phases, skills: readList(graph.skills).flatMap((skill) => readSkill(skill)) };
}

/** The goal details the planner reads, for a goal of `kind` (see `PLANNER_DETAILS`). */
export function pickDetails({
  details,
  keys,
}: {
  details: JsonValue;
  keys: readonly string[];
}): Record<string, JsonValue> {
  const record = isRecord(details) ? details : {};

  return Object.fromEntries(
    keys.flatMap((key) => {
      const value = record[key];
      return value === undefined ? [] : [[key, value]];
    }),
  );
}

/**
 * A graph built from courses, in teaching order as a written graph is: each skill right after what
 * it builds on, which moves up to the earliest phase that needs it; otherwise in the courses' order.
 */
export function inTeachingOrder({
  graph,
  prerequisites,
}: {
  graph: Graph;
  prerequisites: readonly { prerequisiteId: string; skillId: string }[];
}): Graph {
  const byId = new Map(graph.skills.map((skill) => [skill.skillId, skill]));

  const needs = Map.groupBy(
    prerequisites.filter(
      (edge) => byId.has(edge.prerequisiteId) && edge.skillId !== edge.prerequisiteId,
    ),
    (edge) => edge.skillId,
  );

  const placed = new Map<string, GraphSkill>();
  const visiting = new Set<string>();

  // Depth first: a skill's prerequisites go before it, in the phase of the first skill needing them.
  const place = (skill: GraphSkill, phase: number) => {
    if (placed.has(skill.skillId) || visiting.has(skill.skillId)) {
      return;
    }

    visiting.add(skill.skillId);
    const own = Math.min(skill.phase, phase);

    for (const edge of needs.get(skill.skillId) ?? []) {
      const prerequisite = byId.get(edge.prerequisiteId);

      if (prerequisite) {
        place(prerequisite, own);
      }
    }

    placed.set(skill.skillId, { ...skill, phase: own });
  };

  for (const skill of graph.skills) {
    place(skill, skill.phase);
  }

  return { ...graph, skills: [...placed.values()] };
}

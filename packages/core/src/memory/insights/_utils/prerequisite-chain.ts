import "server-only";
import { prisma } from "@zoonk/db";
import { libraryRowsVisibleTo } from "../../../library/_utils/library-visibility";
import { type ActivitySkill } from "./activity-signals";
import { FEW_LESSONS, type PrerequisiteEdge } from "./gap-size";

const MAX_DEPTH = FEW_LESSONS + 1;

const MAX_SKILLS = 40;

export type PrerequisiteGraph = { edges: PrerequisiteEdge[]; skills: Map<string, ActivitySkill> };

export async function loadKnownSkillIds({
  skillIds,
  userId,
}: {
  skillIds: readonly string[];
  userId: string;
}): Promise<Set<string>> {
  if (skillIds.length === 0) {
    return new Set();
  }

  const rows = await prisma.learnerSkill.findMany({
    select: { skillId: true },
    where: { skillId: { in: [...skillIds] }, state: { not: "new" }, userId },
  });

  return new Set(rows.map((row) => row.skillId));
}

async function walk({
  depth,
  excludedIds,
  frontier,
  graph,
  userId,
}: {
  depth: number;
  excludedIds: readonly string[];
  frontier: readonly string[];
  graph: PrerequisiteGraph;
  userId: string;
}): Promise<PrerequisiteGraph> {
  if (frontier.length === 0 || depth >= MAX_DEPTH || graph.skills.size >= MAX_SKILLS) {
    return graph;
  }

  const rows = await prisma.skillPrerequisite.findMany({
    include: { prerequisite: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
    where: {
      prerequisite: { ...libraryRowsVisibleTo(userId), mergedIntoId: null },
      prerequisiteId: { notIn: [...excludedIds] },
      skillId: { in: [...frontier] },
    },
  });

  const found = [...new Set(rows.map((row) => row.prerequisiteId))].filter(
    (skillId) => !graph.skills.has(skillId),
  );

  const known = await loadKnownSkillIds({ skillIds: found, userId });
  const kept = rows.filter((row) => !known.has(row.prerequisiteId));

  return walk({
    depth: depth + 1,
    excludedIds,
    frontier: found.filter((skillId) => !known.has(skillId)),
    graph: {
      edges: [
        ...graph.edges,
        ...kept.map((row) => ({ prerequisiteId: row.prerequisiteId, skillId: row.skillId })),
      ],
      skills: new Map([
        ...graph.skills,
        ...kept.map((row): [string, ActivitySkill] => [row.prerequisite.id, row.prerequisite]),
      ]),
    },
    userId,
  });
}

export async function loadUnlearnedPrerequisites({
  excludedIds,
  skillIds,
  userId,
}: {
  excludedIds: readonly string[];
  skillIds: readonly string[];
  userId: string;
}): Promise<PrerequisiteGraph> {
  return walk({
    depth: 0,
    excludedIds,
    frontier: skillIds,
    graph: { edges: [], skills: new Map() },
    userId,
  });
}

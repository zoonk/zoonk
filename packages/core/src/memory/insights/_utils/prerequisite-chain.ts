import "server-only";
import { prisma } from "@zoonk/db";
import { libraryRowsVisibleTo } from "../../../library/_utils/library-visibility";
import { type ActivitySkill } from "./activity-signals";
import { FEW_LESSONS, type PrerequisiteEdge } from "./gap-size";

/**
 * How far up a gap reaches: one level past a few lessons, enough to tell a few lessons from a
 * chapter's worth. Anything further back is for a later insight, once the nearer lessons show
 * whether it's needed.
 */
const MAX_DEPTH = FEW_LESSONS + 1;

/** Skills with a lot behind them stop the walk early; the chapter stands in for the rest. */
const MAX_SKILLS = 40;

export type PrerequisiteGraph = {
  /** Every edge the walk followed, each skill pointing at a prerequisite it rests on. */
  edges: PrerequisiteEdge[];
  skills: Map<string, ActivitySkill>;
};

/** Skills the learner has started (Learning or better): what they know ends a gap's chain. */
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

/**
 * Walks up from the skills a learner struggles with, one level at a time, over prerequisites the
 * plan doesn't teach (`excludedIds`) and the learner hasn't started: the unlearned chains gaps are
 * sized from. A prerequisite the learner already knows ends its branch. Merged skills are left to
 * their survivor, and another learner's private skills never show up.
 */
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

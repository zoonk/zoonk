import "server-only";
import { type TransactionClient, prisma, sql } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { type ExamStructure, examStructureSchema } from "../library/exams/blueprint-contract";
import { getSkillArea, getWrittenTestAreas } from "../plans/planner/graph-areas";
import { type PlanGraph, parsePlanGraph, parsePlanSettings } from "../plans/planner/plan-state";

export function getWritingSkillIds({
  graph,
  section,
  structure,
}: {
  graph: PlanGraph;
  section?: string;
  structure: ExamStructure | null;
}): Set<string> {
  if (!structure) {
    return new Set();
  }

  const essayFormats = structure.formats.filter(({ kind }) => kind === "essay");

  const names = new Set([
    ...(structure.mock?.sections ?? [])
      .filter(({ kind }) => kind === "written")
      .map(({ name }) => normalizeString(name)),
    ...essayFormats.flatMap(({ sections }) =>
      (sections ?? []).map((name) => normalizeString(name)),
    ),
  ]);

  if (names.size === 0 && essayFormats.length === 0) {
    return new Set();
  }

  const writtenSubjects = structure.subjects
    .filter(({ group }) => group && names.has(normalizeString(group)))
    .map(({ name }) => normalizeString(name));

  const writtenAreas = new Set([...names, ...writtenSubjects]);

  const bySection = section ? normalizeString(section) : null;

  const sectionNames = new Set([
    bySection,
    ...structure.subjects.flatMap(({ group, name }) =>
      group && normalizeString(group) === bySection ? [normalizeString(name)] : [],
    ),
  ]);

  const outcomes = getWrittenTestAreas(graph);

  const matches = graph.skills.filter((skill) => {
    const area = getSkillArea({ graph, skill });

    return writtenAreas.has(normalizeString(area)) || outcomes.has(area);
  });

  const inSection = bySection
    ? matches.filter((skill) => sectionNames.has(normalizeString(getSkillArea({ graph, skill }))))
    : [];

  return new Set((inSection.length > 0 ? inSection : matches).map((skill) => skill.skillId));
}

type WritingFact = {
  examBlueprintId: string | null;
  planId: string | null;
  skillIds: string[] | null;
};

async function readLegacySkills(planIds: string[], tx: TransactionClient) {
  if (planIds.length === 0) {
    return new Map<string, Set<string>>();
  }

  const plans = await tx.plan.findMany({
    select: {
      goal: { select: { examBlueprint: { select: { structure: true } } } },
      graph: true,
      id: true,
    },
    where: { id: { in: planIds } },
  });

  return new Map(
    plans.map(({ goal, graph, id }) => [
      id,
      getWritingSkillIds({
        graph: parsePlanGraph(graph),
        structure: examStructureSchema.safeParse(goal.examBlueprint?.structure).data ?? null,
      }),
    ]),
  );
}

async function resolveWritingSkills(facts: WritingFact[], tx: TransactionClient) {
  const legacy = await readLegacySkills(
    facts.flatMap(({ planId, skillIds }) => (planId && skillIds === null ? [planId] : [])),
    tx,
  );

  return new Set(
    facts.flatMap(
      ({ planId, skillIds }) => skillIds ?? (planId ? [...(legacy.get(planId) ?? [])] : []),
    ),
  );
}

export async function loadGoalWritingFact(goalId: string, tx: TransactionClient = prisma) {
  const rows = await tx.$queryRaw<WritingFact[]>(sql`
    SELECT g.exam_blueprint_id AS "examBlueprintId", p.id AS "planId",
           p.settings -> 'writtenSkillIds' AS "skillIds"
    FROM goals g
    LEFT JOIN plans p ON p.goal_id = g.id
    WHERE g.id = ${goalId}::uuid AND g.kind = 'exam' AND g.exam_blueprint_id IS NOT NULL
  `);

  return {
    examBlueprintId: rows[0]?.examBlueprintId ?? null,
    skillIds: await resolveWritingSkills(rows, tx),
  };
}

export async function loadWritingSkillIds(goalId: string, tx: TransactionClient = prisma) {
  const fact = await loadGoalWritingFact(goalId, tx);
  return fact.skillIds;
}

export async function loadExamWritingSkillIdsForLearner({
  skillIds,
  tx,
  userId,
}: {
  skillIds: readonly string[];
  tx: TransactionClient;
  userId: string;
}): Promise<Set<string>> {
  if (skillIds.length === 0) {
    return new Set();
  }

  const rows = await tx.$queryRaw<WritingFact[]>(sql`
    SELECT g.exam_blueprint_id AS "examBlueprintId", p.id AS "planId",
           p.settings -> 'writtenSkillIds' AS "skillIds"
    FROM goals g
    JOIN plans p ON p.goal_id = g.id
    WHERE g.user_id = ${userId}::uuid AND g.kind = 'exam' AND g.exam_blueprint_id IS NOT NULL
      AND g.status <> 'archived'
  `);

  const written = await resolveWritingSkills(rows, tx);
  return new Set(skillIds.filter((id) => written.has(id)));
}

/** Runs with the dependent plans locked by the same blueprint write. */
export async function refreshBlueprintWritingSkills({
  blueprintId,
  structure,
  tx,
}: {
  blueprintId: string;
  structure: ExamStructure;
  tx: TransactionClient;
}) {
  const plans = await tx.plan.findMany({
    select: { graph: true, id: true, settings: true },
    where: { goal: { examBlueprintId: blueprintId, kind: "exam" } },
  });

  const changed = plans.flatMap(({ graph, id, settings }) => {
    const saved = parsePlanSettings(settings).writtenSkillIds;
    const next = [...getWritingSkillIds({ graph: parsePlanGraph(graph), structure })];

    return saved &&
      saved.length === next.length &&
      saved.every((skillId, index) => skillId === next[index])
      ? []
      : [{ id, skill_ids: next }];
  });

  if (changed.length > 0) {
    await tx.$executeRaw`
      UPDATE plans p
      SET settings = jsonb_set(p.settings, '{writtenSkillIds}', next.skill_ids)
      FROM jsonb_to_recordset(${JSON.stringify(changed)}::jsonb) AS next(id uuid, skill_ids jsonb)
      WHERE p.id = next.id
    `;
  }
}

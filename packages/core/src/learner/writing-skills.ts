import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { namesMatch } from "../exams/_utils/name-match";
import { type ExamStructure } from "../library/exams/blueprint-contract";
import { readBlueprintContent } from "../library/exams/save-exam-blueprint";
import { listWrittenTasks } from "../library/exams/written-tasks";
import { getSkillArea, getWrittenTestAreas } from "../plans/planner/graph-areas";
import { type PlanGraph, parsePlanGraph } from "../plans/planner/plan-state";

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

  const names = (structure.mock?.sections ?? [])
    .filter(({ kind }) => kind === "written")
    .map(({ name }) => name);

  const hasWriting =
    names.length > 0 ||
    structure.formats.some(({ kind }) => kind === "essay") ||
    listWrittenTasks({ structure }).length > 0;

  if (!hasWriting) {
    return new Set();
  }

  const outcomes = getWrittenTestAreas(graph);

  const matches = graph.skills.filter((skill) => {
    const area = getSkillArea({ graph, skill });

    return (
      names.some((name) => namesMatch(area, name)) ||
      outcomes.has(area) ||
      /discursiv|reda[cç][aã]o|pe[cç]a t[eé]cnica/iu.test(area)
    );
  });

  const inSection = section
    ? matches.filter((skill) => namesMatch(getSkillArea({ graph, skill }), section))
    : [];

  return new Set((inSection.length > 0 ? inSection : matches).map((skill) => skill.skillId));
}

export async function loadWritingSkillIds(
  goalId: string,
  tx: TransactionClient = prisma,
): Promise<Set<string>> {
  const goal = await tx.goal.findUnique({
    select: { examBlueprint: true, kind: true, plan: { select: { graph: true } } },
    where: { id: goalId },
  });

  return goal?.kind === "exam" && goal.examBlueprint
    ? getWritingSkillIds({
        graph: parsePlanGraph(goal.plan?.graph),
        structure: readBlueprintContent(goal.examBlueprint).structure,
      })
    : new Set();
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

  const plans = await tx.plan.findMany({
    select: { goal: { select: { examBlueprint: true } }, graph: true },
    where: {
      goal: { examBlueprintId: { not: null }, kind: "exam", status: "active", userId },
      items: { some: { skillId: { in: [...skillIds] } } },
    },
  });

  const written = plans.flatMap(({ goal, graph }) =>
    goal.examBlueprint
      ? [
          ...getWritingSkillIds({
            graph: parsePlanGraph(graph),
            structure: readBlueprintContent(goal.examBlueprint).structure,
          }),
        ]
      : [],
  );

  return new Set(written);
}

import "server-only";
import { type ExamBlueprint, type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { readDatabaseFacts } from "../../_utils/read-database-facts";
import { getSkillArea } from "../../plans/planner/graph-areas";
import {
  type PlanGraph,
  type PlanGraphSkill,
  parsePlanGraph,
} from "../../plans/planner/plan-state";
import { namesMatch } from "../_utils/name-match";
import { type ListeningExam, toListeningExam } from "./listening-exam";

export type ListeningSkill = { description: string; name: string; skillId: string };

function isInListeningArea({
  graph,
  sectionNames,
  skill,
}: {
  graph: PlanGraph;
  sectionNames: readonly string[];
  skill: PlanGraphSkill;
}): boolean {
  const area = getSkillArea({ graph, skill });
  return sectionNames.some((sectionName) => namesMatch(area, sectionName));
}

export function getListeningSkillIds({
  exam,
  graph,
}: {
  exam: ListeningExam | null;
  graph: PlanGraph;
}): Set<string> {
  if (!exam) {
    return new Set();
  }

  const sectionNames = [...new Set(exam.parts.map((part) => part.sectionName))];

  return new Set(
    graph.skills
      .filter((skill) => isInListeningArea({ graph, sectionNames, skill }))
      .map((skill) => skill.skillId),
  );
}

const LISTENING_GOAL_SELECT = { examBlueprint: true, kind: true, targetLanguage: true } as const;

export async function loadGoalListeningSkillIds({
  blueprint,
  goal,
  graph,
}: {
  blueprint?: ExamBlueprint | null;
  goal: Pick<Goal, "examBlueprintId" | "kind" | "targetLanguage">;
  graph: unknown;
}): Promise<Set<string>> {
  if (goal.kind !== "exam" || !goal.examBlueprintId) {
    return new Set();
  }

  const examBlueprint =
    blueprint === undefined
      ? await prisma.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } })
      : blueprint;

  return getListeningSkillIds({
    exam: toListeningExam({ ...goal, examBlueprint }),
    graph: parsePlanGraph(graph),
  });
}

/** Internal: the caller must already have resolved the goal for the learner. */
export async function loadListeningSkillIds(
  goalId: string,
  tx: TransactionClient = prisma,
): Promise<Set<string>> {
  const [goal, plan] = await readDatabaseFacts(
    tx,
    () => tx.goal.findUnique({ select: LISTENING_GOAL_SELECT, where: { id: goalId } }),
    () => tx.plan.findUnique({ select: { graph: true }, where: { goalId } }),
  );

  if (!goal) {
    return new Set();
  }

  return getListeningSkillIds({ exam: toListeningExam(goal), graph: parsePlanGraph(plan?.graph) });
}

export async function loadListeningSkills({
  examBlueprintId,
  sectionName,
}: {
  examBlueprintId: string;
  sectionName: string;
}): Promise<ListeningSkill[]> {
  const stored = await prisma.examSkillGraph.findUnique({
    select: { graph: true },
    where: { examBlueprintId },
  });

  const graph = parsePlanGraph(stored?.graph);

  const skillIds = graph.skills
    .filter((skill) => isInListeningArea({ graph, sectionNames: [sectionName], skill }))
    .map((skill) => skill.skillId);

  if (skillIds.length === 0) {
    return [];
  }

  const skills = await prisma.skill.findMany({
    select: { description: true, id: true, name: true },
    where: { id: { in: skillIds } },
  });

  const byId = new Map(skills.map((skill) => [skill.id, skill]));

  return skillIds.flatMap((skillId) => {
    const skill = byId.get(skillId);
    return skill ? [{ description: skill.description, name: skill.name, skillId }] : [];
  });
}

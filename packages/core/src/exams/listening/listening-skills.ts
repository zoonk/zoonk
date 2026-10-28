import "server-only";
import { type ExamBlueprint, type Goal, type TransactionClient, prisma } from "@zoonk/db";
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

export async function listDrillableMistakes<
  T extends { itemId: string | null; skillId: string | null },
>({
  listeningSkillIds,
  mistakes,
}: {
  listeningSkillIds: ReadonlySet<string>;
  mistakes: readonly T[];
}): Promise<T[]> {
  const isHeard = (mistake: T) =>
    mistake.skillId !== null && listeningSkillIds.has(mistake.skillId);

  const heard = mistakes.filter((mistake) => isHeard(mistake));

  if (heard.length === 0) {
    return [...mistakes];
  }

  const recorded = await prisma.item.findMany({
    select: { id: true },
    where: { id: { in: heard.flatMap((mistake) => mistake.itemId ?? []) }, set: { kind: "audio" } },
  });

  const recordedIds = new Set(recorded.map((item) => item.id));

  return mistakes.filter(
    (mistake) => !isHeard(mistake) || (mistake.itemId !== null && recordedIds.has(mistake.itemId)),
  );
}

export function isDrillQuestion({
  item,
  listeningSkillIds,
  mistakeItemId,
}: {
  item: { id: string; skillId: string };
  listeningSkillIds: ReadonlySet<string>;
  mistakeItemId: string | null;
}): boolean {
  return !listeningSkillIds.has(item.skillId) || item.id === mistakeItemId;
}

const LISTENING_GOAL_SELECT = {
  examBlueprint: true,
  kind: true,
  plan: { select: { graph: true } },
  targetLanguage: true,
} as const;

export async function loadLearnerListeningSkillIds(userId: string): Promise<Set<string>> {
  const goals = await prisma.goal.findMany({
    select: LISTENING_GOAL_SELECT,
    where: { examBlueprintId: { not: null }, kind: "exam", userId },
  });

  return new Set(
    goals.flatMap((goal) => [
      ...getListeningSkillIds({
        exam: toListeningExam(goal),
        graph: parsePlanGraph(goal.plan?.graph),
      }),
    ]),
  );
}

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
  const goal = await tx.goal.findUnique({ select: LISTENING_GOAL_SELECT, where: { id: goalId } });

  if (!goal) {
    return new Set();
  }

  return getListeningSkillIds({
    exam: toListeningExam(goal),
    graph: parsePlanGraph(goal.plan?.graph),
  });
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

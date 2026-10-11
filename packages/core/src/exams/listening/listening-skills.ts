import "server-only";
import { prisma } from "@zoonk/db";
import { getSkillArea } from "../../plans/planner/graph-areas";
import {
  type PlanGraph,
  type PlanGraphSkill,
  parsePlanGraph,
} from "../../plans/planner/plan-state";
import { namesMatch } from "../_utils/name-match";
import { type ListeningExam, toListeningExam } from "./listening-exam";

/** A skill a listening set's questions test, as the set's writer reads it. */
export type ListeningSkill = { description: string; name: string; skillId: string };

/** Whether the skill's area is one of these listening sections' ("Listening"). */
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

/**
 * The skills of a goal's graph that are practiced only with its exam's listening recordings: those
 * in a listening section's area. A text question about a conversation tests reading, not
 * listening, so item writers write these skills none, practice asks them only a recording's
 * questions (and leaves them waiting while none is voiced), and placement never picks them. Empty
 * for a goal without listening (`exam` null, see `toListeningExam`), whose skills keep text
 * questions.
 */
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

/**
 * The open mistakes a drill can bring back: on a skill practiced only with recordings, only a
 * missed recording question, which comes back with its recording. A text question there tests
 * reading, so an old text mistake on it stays in the notebook and never takes a drill's place.
 */
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

/**
 * Whether a mistake's drill may ask this question: any on a skill with text questions; on one
 * practiced only with recordings, just the missed recording question itself
 * (`listDrillableMistakes`), never more on its skill.
 */
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

/** What `getListeningSkillIds` reads of a goal. */
const LISTENING_GOAL_SELECT = {
  examBlueprint: true,
  kind: true,
  plan: { select: { graph: true } },
  targetLanguage: true,
} as const;

/**
 * The skills a learner's goals practice only with recordings, across every goal they have: for
 * what isn't asked for one goal (the mistakes notebook without a goal), a skill that is a
 * listening skill in any of them counts as one.
 */
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

/**
 * `getListeningSkillIds` for a goal by its id, on its plan's graph; empty while it has no plan.
 * Internal: the caller passes a goal it already resolved.
 */
export async function loadListeningSkillIds(goalId: string): Promise<Set<string>> {
  const goal = await prisma.goal.findUnique({
    select: LISTENING_GOAL_SELECT,
    where: { id: goalId },
  });

  if (!goal) {
    return new Set();
  }

  return getListeningSkillIds({
    exam: toListeningExam(goal),
    graph: parsePlanGraph(goal.plan?.graph),
  });
}

/**
 * The skills a listening section tests: those of the exam's shared skill graph whose area the
 * section names ("Listening"), in the graph's order. Shared, so every learner of the exam gets the
 * same sets. Empty when the exam has no graph yet or none of its areas is the section's.
 */
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

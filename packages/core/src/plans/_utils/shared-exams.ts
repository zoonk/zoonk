import "server-only";
import { type Goal } from "@zoonk/db";
import { loadSkillSurvivorMap } from "../../learner/_utils/update-learner-skill";
import { type OtherExamGoal, readOtherExamGoals } from "../../learner/facts/other-exam-goals";
import { type PlanView } from "../plan-view-contract";
import { getSkillArea } from "../planner/graph-areas";
import { type PlanGraph } from "../planner/plan-state";

export type SharedExams = { areas: ReadonlyMap<string, string[]>; exams: PlanView["sharedExams"] };

const NONE: SharedExams = { areas: new Map(), exams: [] };

function findSharedExams({
  graph,
  others,
  survivorOf,
}: {
  graph: PlanGraph;
  others: readonly OtherExamGoal[];
  survivorOf: (skillId: string) => string;
}): SharedExams {
  const held = others.map((other) => ({
    ...other,
    skillIds: new Set(other.skillIds.map(survivorOf)),
  }));

  const byArea = Map.groupBy(graph.skills, (skill) => getSkillArea({ graph, skill }));

  const areas = new Map(
    [...byArea].flatMap(([area, skills]) => {
      const goalIds = held
        .filter((other) => skills.some((skill) => other.skillIds.has(survivorOf(skill.skillId))))
        .map((other) => other.goalId);

      return goalIds.length > 0 ? [[area, goalIds] as const] : [];
    }),
  );

  const sharing = new Set([...areas.values()].flat());

  return {
    areas,
    exams: held
      .filter((other) => sharing.has(other.goalId))
      .map(({ goalId, name }) => ({ goalId, name })),
  };
}

export async function loadSharedExams({
  goal,
  graph,
}: {
  goal: Pick<Goal, "id" | "kind" | "userId">;
  graph: PlanGraph;
}): Promise<SharedExams> {
  if (goal.kind !== "exam") {
    return NONE;
  }

  const others = await readOtherExamGoals(goal.userId, goal.id);

  if (others.length === 0) {
    return NONE;
  }

  const survivors = await loadSkillSurvivorMap([
    ...graph.skills.map((skill) => skill.skillId),
    ...others.flatMap((other) => other.skillIds),
  ]);

  return findSharedExams({
    graph,
    others,
    survivorOf: (skillId) => survivors.get(skillId) ?? skillId,
  });
}

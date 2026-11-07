import "server-only";
import { type Goal } from "@zoonk/db";
import { loadSkillSurvivorMap } from "../../learner/_utils/update-learner-skill";
import { type OtherExamGoal, readOtherExamGoals } from "../../learner/facts/other-exam-goals";
import { type PlanView } from "../plan-view-contract";
import { getSkillArea } from "../planner/graph-areas";
import { type PlanGraph, type PlanGraphSkill } from "../planner/plan-state";

export type SharedExams = { areas: ReadonlyMap<string, string[]>; exams: PlanView["sharedExams"] };

const NONE: SharedExams = { areas: new Map(), exams: [] };

/**
 * Completion credits a lesson in every plan that holds it, and the planner takes a skill's lessons
 * only from the courses its graph names (from any course when it names none). So two plans teach a
 * skill with the same lessons only when they name the same courses for it.
 */
function findSharedExams({
  graph,
  others,
  survivorOf,
}: {
  graph: PlanGraph;
  others: readonly OtherExamGoal[];
  survivorOf: (skillId: string) => string;
}): SharedExams {
  const lessonSource = ({
    courseIds = [],
    skillId,
  }: Pick<PlanGraphSkill, "courseIds" | "skillId">) =>
    [survivorOf(skillId), ...courseIds.toSorted()].join(" ");

  const held = others.map((other) => ({
    ...other,
    sources: new Set(other.skills.map(lessonSource)),
  }));

  const byArea = Map.groupBy(graph.skills, (skill) => getSkillArea({ graph, skill }));

  const areas = new Map(
    [...byArea].flatMap(([area, skills]) => {
      const goalIds = held
        .filter((other) => skills.some((skill) => other.sources.has(lessonSource(skill))))
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
    ...others.flatMap((other) => other.skills.map((skill) => skill.skillId)),
  ]);

  return findSharedExams({
    graph,
    others,
    survivorOf: (skillId) => survivors.get(skillId) ?? skillId,
  });
}

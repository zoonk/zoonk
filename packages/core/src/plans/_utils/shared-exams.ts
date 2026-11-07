import "server-only";
import { type Goal } from "@zoonk/db";
import { type OtherExamGoal, readOtherExamGoals } from "../../learner/facts/other-exam-goals";
import { type SavedPlan, readSavedPlan } from "../../learner/facts/saved-plan";
import { getSkillArea } from "../planner/graph-areas";
import { parsePlanGraph } from "../planner/plan-state";
import { type SharedExam } from "../shared-exams-contract";

export type SharedExams = { areas: ReadonlyMap<string, string[]>; exams: SharedExam[] };

const NONE: SharedExams = { areas: new Map(), exams: [] };

function findSharedExams({
  others,
  plan,
}: {
  others: readonly OtherExamGoal[];
  plan: SavedPlan;
}): SharedExams {
  const graph = parsePlanGraph(plan.graph);

  const skillAreas = new Map(
    graph.skills.map((skill) => [skill.skillId, getSkillArea({ graph, skill })]),
  );

  const held = others.map((other) => ({ ...other, lessons: new Set(other.lessonIds) }));

  const lessons = plan.items.flatMap((item) => {
    const area = item.skillId ? skillAreas.get(item.skillId) : undefined;

    return item.kind === "lesson" && item.lessonId && area !== undefined
      ? [{ area, lessonId: item.lessonId }]
      : [];
  });

  const byArea = Map.groupBy(lessons, (lesson) => lesson.area);

  const areas = new Map(
    [...byArea].flatMap(([area, items]) => {
      const goalIds = held
        .filter((other) => items.some((item) => other.lessons.has(item.lessonId)))
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

/** GET-only, after ownership authorization. */
export async function readSharedExams(
  goal: Pick<Goal, "id" | "kind" | "userId">,
): Promise<SharedExams> {
  if (goal.kind !== "exam") {
    return NONE;
  }

  const [plan, others] = await Promise.all([
    readSavedPlan(goal.userId, goal.id),
    readOtherExamGoals(goal.userId, goal.id),
  ]);

  if (!plan || others.length === 0) {
    return NONE;
  }

  return findSharedExams({ others, plan });
}

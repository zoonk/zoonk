import { setUpPlanNow } from "../../plans/plan-setup";
import { getGoal } from "../get-goal";
import { prepareCourseGoalPlan } from "../prepare-course-goal-plan";
import { startCourseGoal } from "../start-course-goal";

export async function startCourseWithPlan(input: Parameters<typeof startCourseGoal>[0]) {
  const result = await startCourseGoal(input);

  if (result.status !== "created") {
    return result;
  }

  await prepareCourseGoalPlan({ goalId: result.goal.id });
  await setUpPlanNow(result.goal.id);
  const prepared = await getGoal(result.goal.id);

  if (prepared.status !== "ready") {
    throw new Error("The started course goal is missing.");
  }

  return { ...result, goal: prepared.goal };
}

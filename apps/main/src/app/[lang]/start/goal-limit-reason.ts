import { type GoalRefusal } from "@zoonk/core/goals/create";
import { type GoalLimitReason } from "@zoonk/learn/onboarding/actions";

/** Which of the plan's goal limits refused the goal, so the learner reads what applies to them. */
export function getGoalLimitReason(decision: GoalRefusal["decision"] | undefined): GoalLimitReason {
  if (!decision || decision.status === "slowDown") {
    return "slowDown";
  }

  if (decision.limit.tier === "guest") {
    return "guest";
  }

  if (decision.limit.resource === "activeGoals") {
    return "oneActiveGoal";
  }

  const monthly = decision.limit.period === "month";

  if (decision.limit.resource === "explanation") {
    return monthly ? "monthlyExplanations" : "dailyExplanations";
  }

  return monthly ? "monthlyGoals" : "dailyGoals";
}

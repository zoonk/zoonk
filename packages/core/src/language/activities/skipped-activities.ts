import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { findLearnerLanguageGoal } from "../_utils/language-goal";
import { type LanguageActivityType } from "./language-activities";

async function readSkippedActivities(goalId: string): Promise<LanguageActivityType[]> {
  const plan = await prisma.plan.findUnique({ select: { settings: true }, where: { goalId } });
  return plan ? parsePlanSettings(plan.settings).skippedActivities : [];
}

export async function loadSkippedActivities({
  activeGoal,
  targetLanguage,
  userId,
}: {
  activeGoal?: Goal | null;
  targetLanguage: string;
  userId: string;
}): Promise<LanguageActivityType[]> {
  const goal = await findLearnerLanguageGoal({ activeGoal, targetLanguage, userId });
  return goal ? readSkippedActivities(goal.id) : [];
}

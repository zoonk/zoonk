import "server-only";
import { prisma } from "@zoonk/db";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { findLearnerLanguageGoal } from "../_utils/language-goal";
import { type LanguageActivityType } from "./language-activities";

async function readSkippedActivities(goalId: string): Promise<LanguageActivityType[]> {
  const plan = await prisma.plan.findUnique({ select: { settings: true }, where: { goalId } });
  return plan ? parsePlanSettings(plan.settings).skippedActivities : [];
}

export async function loadSkippedActivities({
  activeGoalId,
  targetLanguage,
  userId,
}: {
  activeGoalId?: string | null;
  targetLanguage: string;
  userId: string;
}): Promise<LanguageActivityType[]> {
  const goal = await findLearnerLanguageGoal({ activeGoalId, targetLanguage, userId });
  return goal ? readSkippedActivities(goal.id) : [];
}

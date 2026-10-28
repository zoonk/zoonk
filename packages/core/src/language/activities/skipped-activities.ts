import "server-only";
import { prisma } from "@zoonk/db";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { findLearnerLanguageGoal } from "../_utils/language-goal";
import { type LanguageActivityType } from "./language-activities";

async function readSkippedActivities(goalId: string): Promise<LanguageActivityType[]> {
  const plan = await prisma.plan.findUnique({ select: { settings: true }, where: { goalId } });
  return plan ? parsePlanSettings(plan.settings).skippedActivities : [];
}

/** What the learner's plan for a language leaves out; nothing without a plan. */
export async function loadSkippedActivities({
  targetLanguage,
  userId,
}: {
  targetLanguage: string;
  userId: string;
}): Promise<LanguageActivityType[]> {
  const goal = await findLearnerLanguageGoal({ targetLanguage, userId });
  return goal ? readSkippedActivities(goal.id) : [];
}

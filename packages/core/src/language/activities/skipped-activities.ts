import "server-only";
import { prisma } from "@zoonk/db";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { findLearnerLanguageGoal } from "../_utils/language-goal";
import { type LanguageActivityType } from "./language-activities";

async function readSkippedActivities(goalId: string): Promise<LanguageActivityType[] | null> {
  const plan = await prisma.plan.findUnique({ select: { settings: true }, where: { goalId } });
  return plan ? parsePlanSettings(plan.settings).skippedActivities : null;
}

/** Null when no plan of the learner's covers the language, so nothing leaves its lessons' screens out. */
export async function loadSkippedActivities({
  targetLanguage,
  userId,
}: {
  targetLanguage: string;
  userId: string;
}): Promise<LanguageActivityType[] | null> {
  const goal = await findLearnerLanguageGoal({ targetLanguage, userId });
  return goal ? readSkippedActivities(goal.id) : null;
}

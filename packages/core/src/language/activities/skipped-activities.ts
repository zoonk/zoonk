import "server-only";
import { prisma } from "@zoonk/db";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { getSession } from "../../users/get-session";
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

/**
 * The practice left out in Plan settings for this language, or null without a language goal.
 * Private cached so a prefetched lesson opens with its plan preferences. Temporary in-lesson
 * skips never change this read.
 */
export async function getLanguageActivitySettings({
  targetLanguage,
}: {
  targetLanguage: string;
}): Promise<{ skipped: LanguageActivityType[] } | null> {
  "use cache: private";

  const session = await getSession();

  if (!session || session.user.isAnonymous) {
    return null;
  }

  const goal = await findLearnerLanguageGoal({ targetLanguage, userId: session.user.id });

  if (!goal) {
    return null;
  }

  return { skipped: await readSkippedActivities(goal.id) };
}

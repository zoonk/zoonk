import "server-only";
import { prisma } from "@zoonk/db";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { type PlanChangeResult, changeGoalPlan } from "../../plans/change-goal-plan";
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
 * The language practice the signed-in learner left out of their plan for a language, which lessons
 * in that language skip, or null when they have no goal for it (guests included): then there's no
 * plan to change, so "Skip writing" isn't offered. Private cached, so a prefetched lesson opens
 * with it; changing it is a plan change, which clears the learner's cached views.
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

export type ChangeLanguageActivityResult = PlanChangeResult | { status: "noGoal" };

/**
 * Leaves one kind of practice out of the learner's plan for a language ("Skip writing"), or
 * brings it back. It's a plan change like any other: shown with its reason, and undone anytime.
 */
export async function changeLanguageActivity({
  activity,
  skip,
  targetLanguage,
  timeZone,
}: {
  activity: LanguageActivityType;
  skip: boolean;
  targetLanguage: string;
  timeZone?: string;
}): Promise<ChangeLanguageActivityResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const goal = await findLearnerLanguageGoal({ targetLanguage, userId: session.user.id });

  if (!goal) {
    return { status: "noGoal" };
  }

  const kind = skip ? "skipActivities" : "restoreActivities";

  const result = await changeGoalPlan({
    goalId: goal.id,
    input: { operations: [{ activities: [activity], kind }], timeZone },
  });

  if (result.status === "applied") {
    await trackLearnerEvents({
      events: [{ name: "Plan Edited", properties: { change_kind: kind } }],
      goalId: goal.id,
      userId: session.user.id,
    });
  }

  return result;
}

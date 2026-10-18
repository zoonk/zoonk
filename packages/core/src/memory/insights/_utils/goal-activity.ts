import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../../learner/_utils/owned-goal";
import { type ActivitySignals, buildActivitySignals } from "./activity-signals";
import { loadRecentActivity } from "./load-recent-activity";
import { type PrerequisiteGap, loadPrerequisiteGaps } from "./prerequisite-gaps";

/** A pattern needs answers on more than one day; below this, code already knows there's nothing to say. */
const MIN_ANSWERS = 12;
const MIN_DAYS = 2;

export type GoalActivity = {
  goal: Goal;
  /** The learner-local day the check belongs to. */
  localDate: Date;
  signals: ActivitySignals;
  /** Missing prerequisites of the weakest skills, sized: the only lessons a plan change can add. */
  gaps: PrerequisiteGap[];
  timeZone: string;
};

/** Whether the last week holds enough answers, on enough days, for any pattern to be real. */
export function hasEnoughActivity(signals: ActivitySignals): boolean {
  return signals.answerCount >= MIN_ANSWERS && signals.dayCount >= MIN_DAYS;
}

/** The learner's goal and what their last week of activity shows, or null for another learner's goal. */
export async function loadGoalActivity({
  goalId,
  now,
  timeZone,
  userId,
}: {
  goalId: string;
  now: Date;
  timeZone?: string | null;
  userId: string;
}): Promise<GoalActivity | null> {
  const goal = await prisma.goal.findFirst({ where: { id: goalId, userId } });

  if (!goal) {
    return null;
  }

  const zone = getAnswerTimeZone({ goal, timeZone });
  const activity = await loadRecentActivity({ goal, now, timeZone: zone });
  const signals = buildActivitySignals(activity);

  const gaps = await loadPrerequisiteGaps({
    goal,
    goalSkills: activity.skills,
    weakSkills: signals.weakSkills,
  });

  return {
    gaps,
    goal,
    localDate: getDateInTimeZone({ date: now, timeZone: zone }),
    signals,
    timeZone: zone,
  };
}

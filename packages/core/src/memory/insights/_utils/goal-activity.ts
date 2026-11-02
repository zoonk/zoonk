import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../../learner/_utils/owned-goal";
import { type ActivitySignals, buildActivitySignals } from "./activity-signals";
import { loadRecentActivity } from "./load-recent-activity";
import { type PrerequisiteGap, loadPrerequisiteGaps } from "./prerequisite-gaps";

const MIN_ANSWERS = 12;
const MIN_DAYS = 2;

export type GoalActivity = {
  goal: Goal;
  localDate: Date;
  signals: ActivitySignals;
  gaps: PrerequisiteGap[];
  timeZone: string;
};

export function hasEnoughActivity(signals: ActivitySignals): boolean {
  return signals.answerCount >= MIN_ANSWERS && signals.dayCount >= MIN_DAYS;
}

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

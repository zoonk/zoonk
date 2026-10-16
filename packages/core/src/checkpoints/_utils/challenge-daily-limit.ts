import "server-only";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { getRequestProgressDateContext } from "../../progress/get-request-date-context";
import { readDailyTimeLimitReached } from "../../sessions/_utils/daily-time-limit";
import { getGoalDayMinutes } from "../../sessions/_utils/day-minutes";
import { type CheckpointKind } from "../../sessions/brain-power";
import { getNextStudyDate } from "../../sessions/daily-goal";
import { type OwnedChallenge } from "./owned-challenge";

/**
 * Whether today's study time is used up on the day Start counts it: the learner's day, in their
 * active goal's zone as Today reads it, which can be another date than the challenge's own goal's.
 */
export async function readDailyLimitReachedToday(userId: string): Promise<boolean> {
  const { currentDate } = await getRequestProgressDateContext();
  return readDailyTimeLimitReached({ date: currentDate, userId });
}

/**
 * When a phase challenge today's study time holds back is here again, YYYY-MM-DD: the next day its
 * goal's plan studies, read from the plan the challenge came with, since a boss left to do carries
 * into that day's session. None for the week's challenge: left unstarted, it leaves the plan once a
 * later day re-plans (RULES R24), and Move to Monday keeps it (see `ChallengeView.nextStudyDate`).
 * None for an exam's either: its runs keep phase challenges off the exam's eve and its mocks' own
 * days (see `placeExamBosses`), which no day's study time tells, so its copy names no day.
 */
export function getNextStudyDay({
  challenge,
  dailyLimitReached,
  kind,
}: {
  challenge: Pick<OwnedChallenge, "goal" | "plan" | "today">;
  dailyLimitReached: boolean;
  kind: CheckpointKind;
}): string | null {
  if (!dailyLimitReached || kind === "weekly" || challenge.goal.kind === "exam") {
    return null;
  }

  const { goal, plan, today } = challenge;

  const date = getNextStudyDate({
    getMinutes: (day) => getGoalDayMinutes({ date: day, goal, planSettings: plan.settings }),
    today,
  });

  return date ? toIsoDate(date) : null;
}

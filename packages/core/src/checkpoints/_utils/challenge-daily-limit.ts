import "server-only";
import { getWeeklyMockMinutes } from "../../exams/mocks/mock-plan";
import { canHoldPhaseChallenge } from "../../plans/planner/phase-challenge-days";
import { addDays, toIsoDate } from "../../plans/planner/plan-calendar";
import { toExamWindows } from "../../plans/planner/plan-phases";
import {
  type RunDayInput,
  createDays,
  describeRunDays,
  getPlanStart,
} from "../../plans/planner/plan-run-days";
import {
  DAYS_PER_WEEK,
  type PlanSettings,
  parsePlanPhases,
  parsePlanSettings,
} from "../../plans/planner/plan-state";
import { getRequestProgressDateContext } from "../../progress/get-request-date-context";
import { readDailyTimeLimitReached } from "../../sessions/_utils/daily-time-limit";
import { type CheckpointKind } from "../../sessions/brain-power";
import { type OwnedChallenge } from "./owned-challenge";

/** Uses the active goal's learner-local day, which can differ from the challenge goal's day. */
export async function readDailyLimitReachedToday(userId: string): Promise<boolean> {
  const { currentDate } = await getRequestProgressDateContext();
  return readDailyTimeLimitReached({ date: currentDate, userId });
}

function getTomorrowRunInput({
  challenge,
  settings,
}: {
  challenge: Pick<OwnedChallenge, "goal" | "items" | "plan" | "today">;
  settings: PlanSettings;
}): RunDayInput {
  const { goal, items, plan, today } = challenge;

  return {
    examWindows: toExamWindows(parsePlanPhases(plan.phases)),
    fullMockMinutes: getWeeklyMockMinutes({ fullLength: true, structure: null }),
    goal: { dailyMinutes: goal.dailyMinutes, kind: goal.kind, targetDate: goal.targetDate },
    items,
    mockMinutes: getWeeklyMockMinutes({ fullLength: false, structure: null }),
    settings,
    today: addDays(today, 1),
  };
}

/** Returns a learner-local YYYY-MM-DD within a week, or null for weekly challenges and exams. */
export function getNextStudyDay({
  challenge,
  dailyLimitReached,
  kind,
}: {
  challenge: Pick<OwnedChallenge, "goal" | "items" | "plan" | "today">;
  dailyLimitReached: boolean;
  kind: CheckpointKind;
}): string | null {
  if (!dailyLimitReached || kind === "weekly" || challenge.goal.kind === "exam") {
    return null;
  }

  const settings = parsePlanSettings(challenge.plan.settings);
  const input = getTomorrowRunInput({ challenge, settings });
  const days = createDays({ input, planStart: getPlanStart(input) });
  const { describeDay } = describeRunDays({ days, settings });

  const date = Array.from({ length: DAYS_PER_WEEK }, (_, offset) =>
    addDays(input.today, offset),
  ).find((day) =>
    canHoldPhaseChallenge({
      day: { date: day, shape: describeDay(day) },
      rules: { kind: "lessons" },
    }),
  );

  return date ? toIsoDate(date) : null;
}

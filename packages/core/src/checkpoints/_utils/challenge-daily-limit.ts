import "server-only";
import { isJsonObject } from "@zoonk/utils/json";
import { readCourseStart } from "../../goals/course-start-details";
import { readMockMinutes } from "../../plans/_utils/planner-exam-facts";
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

/**
 * Whether today's study time is used up on the day Start counts it: the learner's day, in their
 * active goal's zone as Today reads it, which can be another date than the challenge's own goal's.
 */
export async function readDailyLimitReachedToday(userId: string): Promise<boolean> {
  const { currentDate } = await getRequestProgressDateContext();
  return readDailyTimeLimitReached({ date: currentDate, userId });
}

/**
 * The input tomorrow's run lays its days out from (see `createDays`), from what the challenge
 * loaded with its plan, as a run reads it (see `computePlan`): nothing more is read.
 */
function getTomorrowRunInput({
  challenge,
  settings,
}: {
  challenge: Pick<OwnedChallenge, "goal" | "items" | "plan" | "today">;
  settings: PlanSettings;
}): RunDayInput {
  const { goal, items, plan, today } = challenge;

  return {
    courseStart: readCourseStart(isJsonObject(goal.details) ? goal.details : {}) !== null,
    examWindows: toExamWindows(parsePlanPhases(plan.phases)),
    goal: { dailyMinutes: goal.dailyMinutes, kind: goal.kind, targetDate: goal.targetDate },
    items,
    ...readMockMinutes({ blueprint: goal.examBlueprint, choices: settings.examChoices }),
    settings,
    today: addDays(today, 1),
  };
}

/**
 * When a phase challenge today's study time holds back is here again, YYYY-MM-DD: the first day,
 * within a week, that the plan's next run can put it on, a day with lesson time (see
 * `canHoldPhaseChallenge`), on the days as tomorrow's run lays them out (see `describeRunDays`),
 * since a boss left to do carries into that day's session. None for the week's challenge: left
 * unstarted, it leaves the plan once a later day re-plans (RULES R24), and Move to Monday keeps it
 * (see `ChallengeView.nextStudyDate`). None for an exam's either: its runs keep phase challenges
 * off the exam's eve and the days its mocks take, as the plan funds them from earlier days (see
 * `placeExamBosses`), which no day's study time tells, so its copy names no day.
 */
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

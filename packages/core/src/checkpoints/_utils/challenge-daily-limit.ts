import "server-only";
import { isJsonObject } from "@zoonk/utils/json";
import { readCourseStart } from "../../goals/course-start-details";
import { readMockMinutes } from "../../plans/_utils/planner-exam-facts";
import {
  canHoldPhaseChallenge,
  getPhaseChallengeDayRules,
} from "../../plans/planner/phase-challenge-days";
import { addDays, toIsoDate } from "../../plans/planner/plan-calendar";
import { getItemKey } from "../../plans/planner/plan-items";
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
import { isBossTeachingItem } from "../checkpoint-rules";
import { readBossOffer } from "./challenge-offer";
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
 * Whether a phase challenge tests teaching of its own phase, as its plan's last run saved what it
 * tests (`testedKeys`). A dated exam's run puts one that doesn't (a window of practice and mocks)
 * where what it would ask from earlier phases settles (see `placeAfterWindow`), which no day's
 * shape tells. Without saved facts, it doesn't.
 */
function testsOwnPhase({ item, items }: Pick<OwnedChallenge, "item" | "items">): boolean {
  const tested = new Set(readBossOffer({ item })?.testedKeys);

  return items.some(
    (planItem) =>
      planItem.phase === item.phase &&
      isBossTeachingItem(planItem) &&
      tested.has(getItemKey(planItem)),
  );
}

/**
 * When a phase challenge today's study time holds back is here again, YYYY-MM-DD: the first day,
 * within a week, that the plan's next run can put it on, by the rule its runs place one by (see
 * `canHoldPhaseChallenge`), on the days as tomorrow's run lays them out (see `describeRunDays`),
 * since a boss left to do carries into that day's session. None for the week's challenge: left
 * unstarted, it leaves the plan once a later day re-plans (RULES R24), and Move to Monday keeps it
 * (see `ChallengeView.nextStudyDate`). None for a dated exam's phase that teaches nothing of its
 * own either (see `testsOwnPhase`): its copy names no day rather than guess one.
 */
export function getNextStudyDay({
  challenge,
  dailyLimitReached,
  kind,
}: {
  challenge: Pick<OwnedChallenge, "goal" | "item" | "items" | "plan" | "today">;
  dailyLimitReached: boolean;
  kind: CheckpointKind;
}): string | null {
  if (!dailyLimitReached || kind === "weekly") {
    return null;
  }

  const settings = parsePlanSettings(challenge.plan.settings);
  const rules = getPhaseChallengeDayRules({ goal: challenge.goal, settings });

  if (rules.kind === "examDays" && !testsOwnPhase(challenge)) {
    return null;
  }

  const input = getTomorrowRunInput({ challenge, settings });
  const days = createDays({ input, planStart: getPlanStart(input) });
  const { describeDay } = describeRunDays({ days, settings });

  const date = Array.from({ length: DAYS_PER_WEEK }, (_, offset) =>
    addDays(input.today, offset),
  ).find((day) => canHoldPhaseChallenge({ day: { date: day, shape: describeDay(day) }, rules }));

  return date ? toIsoDate(date) : null;
}

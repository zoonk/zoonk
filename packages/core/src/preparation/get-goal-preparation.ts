import "server-only";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone, isValidTimeZone } from "@zoonk/utils/time-zone";
import { cacheTag } from "next/cache";
import { getLearnerModelCacheTag } from "../cache/tags";
import { loadGoalScoreEstimate } from "../exams/estimates/load-goal-estimate";
import { getStartOfLocalDay } from "../learner/_utils/local-time";
import { findOwnedGoal } from "../learner/_utils/owned-goal";
import { type SkillStateCounts, countSkillStates } from "../learner/mastery-state";
import { getStartOfWeek } from "../plans/planner/plan-calendar";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { loadCatchUpItems } from "../sessions/_utils/catch-up";
import { loadPreparationInputs } from "./_utils/load-preparation-inputs";
import { type AreaPreparation, getAreaPreparations } from "./area-preparation";
import { type EstimatedScore } from "./estimated-score";
import { type PlanStatus, getMinutesPerItem, getPlanStatus } from "./plan-status";
import {
  type PreparationComponents,
  type PreparationStage,
  getPreparationComponents,
  getPreparationStage,
  getPreparationValue,
} from "./preparation-math";

const WEEK_DAYS = 7;

/**
 * Preparation for one goal, overall and per area.
 * `value` and every part run from 0 to 1. `estimatedScore` exists only after a mock exam and is a
 * range, labeled "Estimated" wherever it shows.
 */
type GoalPreparation = {
  areas: AreaPreparation[];
  components: PreparationComponents;
  estimatedScore: EstimatedScore | null;
  goalId: string;
  skills: SkillStateCounts;
  stage: PreparationStage;
  status: PlanStatus | null;
  value: number;
  weakestAreaId: string | null;
  /** Gained since the learner's week began (Monday 00:00 in their time zone): "+3 this week". */
  weekGain: number;
};

export type GoalPreparationResult =
  | { preparation: GoalPreparation; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/**
 * Builds the preparation view model for one of the learner's goals: the four parts with their
 * evidence (the fourth is an exam's mock exams, or another goal's weekly challenges), the overall
 * number and its gain this week, the plan status, the estimated score after an exam's mock, and
 * each area with its skill states and whether it needs practice. Explanations have none.
 */
export async function getGoalPreparation(goalId: string): Promise<GoalPreparationResult> {
  "use cache: private";

  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  // A quick explanation is one answer, not a goal to prepare for.
  if (owned.goal.kind === "explain") {
    return { status: "notFound" };
  }

  cacheTag(getLearnerModelCacheTag(owned.userId));

  const { currentInstant: now, timeZone: requestTimeZone } = await getRequestProgressDateContext();
  const { goal } = owned;

  const timeZone =
    goal.timezone && isValidTimeZone(goal.timezone) ? goal.timezone : requestTimeZone;

  const today = getDateInTimeZone({ date: now, timeZone });
  const weekStart = getStartOfLocalDay({ localDate: getStartOfWeek(today), timeZone });
  // Areas keep a rolling seven days: rebalancing reads their trend on any day, Mondays included.
  const weekAgo = new Date(now.getTime() - WEEK_DAYS * MS_PER_DAY);

  const [inputs, catchUp] = await Promise.all([
    loadPreparationInputs({ goalId, now, userId: owned.userId }),
    loadCatchUpItems(goalId),
  ]);

  const measure = (asOf: Date) => getPreparationComponents({ ...inputs, asOf });
  const components = measure(now);
  const value = getPreparationValue(components);
  const areas = getAreaPreparations({ ...inputs, now, weekAgo });

  // Only mocks estimate a score: a full review stands in for one in preparation, not for a score.
  const estimatedScore =
    inputs.testKind === "weeklyChallenges"
      ? null
      : await loadGoalScoreEstimate({ goal, ledgerMocks: inputs.mockResults });

  return {
    preparation: {
      areas: areas.areas,
      components,
      estimatedScore,
      goalId,
      skills: countSkillStates(inputs.skills),
      stage: getPreparationStage(value),
      status: getPlanStatus({
        catchUp: catchUp.length,
        items: inputs.planItems,
        minutesPerItem: getMinutesPerItem({
          estimateHours: inputs.estimateHours,
          itemCount: inputs.planItems.length,
        }),
        targetDate: goal.targetDate,
        today,
      }),
      value,
      weakestAreaId: areas.weakestAreaId,
      weekGain: value - getPreparationValue(measure(weekStart)),
    },
    status: "ready",
  };
}

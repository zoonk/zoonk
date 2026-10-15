import "server-only";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone, isValidTimeZone } from "@zoonk/utils/time-zone";
import { cacheTag } from "next/cache";
import { getLearnerModelCacheTag, getUserSubscriptionCacheTag } from "../../cache/tags";
import { arePhaseChallengesRequired } from "../../checkpoints/_utils/phase-challenge-access";
import { loadGoalScoreEstimate } from "../../exams/estimates/load-goal-estimate";
import { getStartOfLocalDay } from "../../learner/_utils/local-time";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { readGoalPlan } from "../../learner/_utils/read-goal-plan";
import { countSkillStates } from "../../learner/mastery-state";
import { type PlanReadContext } from "../../plans/_utils/plan-read-projection";
import { getStartOfWeek } from "../../plans/planner/plan-calendar";
import { getRequestProgressDateContext } from "../../progress/get-request-date-context";
import { loadCatchUpItems } from "../../sessions/_utils/catch-up";
import { loadExamPrepAccess } from "../../sessions/_utils/plus-only-lessons";
import { getAreaPreparations } from "../area-preparation";
import { type GoalPreparationResult } from "../get-goal-preparation";
import { getMinutesPerItem, getPlanStatus } from "../plan-status";
import { measurePreparation } from "../section-preparation";
import { loadPreparationInputs } from "./load-preparation-inputs";

const WEEK_DAYS = 7;

type SelectedPreparationPlan = Pick<PlanReadContext, "items" | "plan" | "state" | "today"> & {
  catchUp?: number;
};

/** Shared evidence and status rules; Today supplies its already authorized in-memory selection. */
export async function loadGoalPreparation({
  goalId,
  selectedPlan,
}: {
  goalId: string;
  selectedPlan?: SelectedPreparationPlan;
}): Promise<GoalPreparationResult> {
  // The request's date doesn't depend on the goal: it's read alongside it.
  const [owned, { currentInstant: now, timeZone: requestTimeZone }] = await Promise.all([
    findOwnedGoal(goalId),
    getRequestProgressDateContext(),
  ]);

  if (owned.status !== "ready") {
    return owned;
  }

  // A quick explanation is one answer, not a goal to prepare for.
  if (owned.goal.kind === "explain") {
    return { status: "notFound" };
  }

  cacheTag(getLearnerModelCacheTag(owned.userId), getUserSubscriptionCacheTag(owned.userId));

  const { goal } = owned;

  const timeZone =
    goal.timezone && isValidTimeZone(goal.timezone) ? goal.timezone : requestTimeZone;

  const today = selectedPlan?.today ?? getDateInTimeZone({ date: now, timeZone });
  const weekStart = getStartOfLocalDay({ localDate: getStartOfWeek(today), timeZone });
  // Areas keep a rolling seven days: rebalancing reads their trend on any day, Mondays included.
  const weekAgo = new Date(now.getTime() - WEEK_DAYS * MS_PER_DAY);

  const [inputs, catchUp, access, phaseChallengesRequired] = await Promise.all([
    loadPreparationInputs({ goalId, now, readPlan: readGoalPlan, userId: owned.userId }),
    loadCatchUpItems(goalId),
    loadExamPrepAccess({ goal, timeZone, today }),
    arePhaseChallengesRequired({ goalKind: goal.kind, userId: owned.userId }),
  ]);

  const measure = (asOf: Date) => measurePreparation({ ...inputs, asOf });
  const { components, sections, stage, value } = measure(now);
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
      sections,
      skills: countSkillStates(inputs.skills),
      stage,
      status: getPlanStatus({
        catchUp: selectedPlan?.catchUp ?? catchUp.length,
        freeWeekOver: access.trialEnded,
        goalKind: goal.kind,
        items: selectedPlan?.items ?? inputs.planItems,
        minutesPerItem: getMinutesPerItem({
          estimateHours: selectedPlan ? selectedPlan.plan.estimateHours : inputs.estimateHours,
          itemCount: selectedPlan?.items.length ?? inputs.planItems.length,
        }),
        phaseChallengesRequired,
        studiesPastTarget: selectedPlan
          ? goal.kind === "exam" && selectedPlan.state.settings.fullCourse
          : inputs.studiesPastTarget,
        targetDate: goal.targetDate,
        today,
      }),
      value,
      weakestAreaId: areas.weakestAreaId,
      weekGain: value - measure(weekStart).value,
    },
    status: "ready",
  };
}

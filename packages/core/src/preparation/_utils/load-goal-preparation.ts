import "server-only";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone, isValidTimeZone } from "@zoonk/utils/time-zone";
import { cacheTag } from "next/cache";
import { getLearnerModelCacheTag, getUserSubscriptionCacheTag } from "../../cache/tags";
import { arePhaseChallengesRequired } from "../../checkpoints/_utils/phase-challenge-access";
import { loadGoalScoreEstimate } from "../../exams/estimates/load-goal-estimate";
import { getStartOfLocalDay } from "../../learner/_utils/local-time";
import { type OwnedGoal } from "../../learner/_utils/owned-goal";
import { readGoalPlan } from "../../learner/_utils/read-goal-plan";
import { type SavedPlan, readSavedPlan } from "../../learner/facts/saved-plan";
import { readActiveSubscription } from "../../learner/facts/subscription";
import { getOwnedGoal } from "../../learner/get-owned-goal";
import { countSkillStates } from "../../learner/mastery-state";
import { readExamBlueprint } from "../../library/exams/read-exam-blueprint";
import { type PlanReadContext } from "../../plans/_utils/plan-read-projection";
import { getStartOfWeek } from "../../plans/planner/plan-calendar";
import { parsePlanPhases } from "../../plans/planner/plan-state";
import { getRequestProgressDateContext } from "../../progress/get-request-date-context";
import { loadCatchUpItems } from "../../sessions/_utils/catch-up";
import { loadExamPrepAccess } from "../../sessions/_utils/plus-only-lessons";
import { getAreaPreparations } from "../area-preparation";
import { type GoalPreparationResult } from "../get-goal-preparation";
import { getMinutesPerItem, getPlanStatus } from "../plan-status";
import { measurePreparation } from "../section-preparation";
import { loadPreparationInputs } from "./load-preparation-inputs";

const WEEK_DAYS = 7;

type SelectedPreparationPlan = Pick<
  PlanReadContext,
  "items" | "phases" | "plan" | "state" | "today"
> & { catchUp?: number };

function getStatusSchedule({
  savedPlan,
  selectedPlan,
}: {
  savedPlan: SavedPlan | null;
  selectedPlan?: SelectedPreparationPlan;
}) {
  if (selectedPlan) {
    const { items, phases, plan } = selectedPlan;
    return { estimateHours: plan.estimateHours, items, phases };
  }

  return {
    estimateHours: savedPlan?.estimateHours ?? null,
    items: savedPlan?.items ?? [],
    phases: parsePlanPhases(savedPlan?.phases),
  };
}

export async function loadGoalPreparation({
  goalId,
  selectedPlan,
}: {
  goalId: string;
  selectedPlan?: SelectedPreparationPlan;
}): Promise<GoalPreparationResult> {
  const [owned, dateContext] = await Promise.all([
    getOwnedGoal(goalId),
    getRequestProgressDateContext(),
  ]);

  if (owned.status !== "ready") {
    return owned;
  }

  return loadOwnedGoalPreparation({ dateContext, owned, selectedPlan });
}

export async function loadOwnedGoalPreparation({
  dateContext: { currentInstant: now, timeZone: requestTimeZone },
  owned,
  selectedPlan,
}: {
  dateContext: Awaited<ReturnType<typeof getRequestProgressDateContext>>;
  owned: Extract<OwnedGoal, { status: "ready" }>;
  selectedPlan?: SelectedPreparationPlan;
}): Promise<GoalPreparationResult> {
  if (owned.goal.kind === "explain") {
    return { status: "notFound" };
  }

  cacheTag(getLearnerModelCacheTag(owned.userId), getUserSubscriptionCacheTag(owned.userId));

  const { goal, userId } = owned;
  const goalId = goal.id;

  const timeZone =
    goal.timezone && isValidTimeZone(goal.timezone) ? goal.timezone : requestTimeZone;

  const today = selectedPlan?.today ?? getDateInTimeZone({ date: now, timeZone });
  const weekStart = getStartOfLocalDay({ localDate: getStartOfWeek(today), timeZone });
  const weekAgo = new Date(now.getTime() - WEEK_DAYS * MS_PER_DAY);

  const [savedPlan, subscription, blueprint] = await Promise.all([
    readSavedPlan(userId, goalId),
    readActiveSubscription(userId),
    goal.examBlueprintId ? readExamBlueprint(goal.examBlueprintId) : null,
  ]);

  const [inputs, catchUp, access, phaseChallengesRequired] = await Promise.all([
    loadPreparationInputs({
      blueprint,
      goal,
      goalId,
      now,
      readPlan: readGoalPlan,
      savedPlan,
      subscription,
      userId,
    }),
    selectedPlan?.catchUp === undefined ? loadCatchUpItems(goalId) : [],
    loadExamPrepAccess({ goal, timeZone, today }),
    arePhaseChallengesRequired({ goalKind: goal.kind, userId }),
  ]);

  const schedule = getStatusSchedule({ savedPlan, selectedPlan });

  const measure = (asOf: Date) => measurePreparation({ ...inputs, asOf });
  const { components, sections, stage, value } = measure(now);
  const areas = getAreaPreparations({ ...inputs, now, weekAgo });

  const estimatedScore =
    inputs.testKind === "weeklyChallenges"
      ? null
      : await loadGoalScoreEstimate({ blueprint, goal, ledgerMocks: inputs.mockResults });

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
        items: schedule.items,
        minutesPerItem: getMinutesPerItem({
          estimateHours: schedule.estimateHours,
          itemCount: schedule.items.length,
        }),
        phaseChallengesRequired,
        phases: schedule.phases,
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

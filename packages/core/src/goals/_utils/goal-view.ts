import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { arePhaseChallengesRequired } from "../../checkpoints/_utils/phase-challenge-access";
import { countLessonProgress } from "../../plans/_utils/work-progress";
import { getWeekdayMinutes, toIsoDate } from "../../plans/planner/plan-calendar";
import { DAYS_PER_WEEK, parsePlanPhases, parsePlanSettings } from "../../plans/planner/plan-state";
import { type GoalView } from "../goal-contract";
import {
  type PlanPhaseFacts,
  getCurrentPhaseFromFacts,
  loadPlanPhaseFacts,
} from "./plan-phase-facts";

type PlanRow = { goalId: string; id: string; phases: unknown; settings: unknown };

/** The weekdays with study time, from the plan's weekly shape; every day without one. */
function getStudyDays({ dailyMinutes, settings }: { dailyMinutes: number; settings: unknown }) {
  const { weekdayMinutes } = parsePlanSettings(settings);

  return Array.from({ length: DAYS_PER_WEEK }, (_, weekday) => weekday).filter(
    (weekday) => getWeekdayMinutes({ calendar: { dailyMinutes, weekdayMinutes }, weekday }) > 0,
  );
}

/**
 * Whether each learner's plans require their phase challenges, checked once per learner: a free
 * language plan shows the Plus call, but progress never depends on its locked challenge.
 */
async function loadChallengeRequirements(facts: readonly PlanPhaseFacts[]) {
  const languageOwners = [
    ...new Set(facts.filter((plan) => plan.goalKind === "language").map((plan) => plan.userId)),
  ];

  const required = await Promise.all(
    languageOwners.map(
      async (userId) =>
        [userId, await arePhaseChallengesRequired({ goalKind: "language", userId })] as const,
    ),
  );

  return new Map(required);
}

/**
 * `findCurrentPhase` for many plans at once, in SQL: each plan's earliest phase with work left (a
 * lesson, written or not, or its challenge), or its last phase once everything is done. Null for a
 * plan without items.
 */
export async function loadCurrentPhases(
  plans: readonly Pick<PlanRow, "id">[],
): Promise<Map<string, number | null>> {
  const facts = await loadPlanPhaseFacts({ planIds: plans.map((plan) => plan.id) });
  const required = await loadChallengeRequirements(facts);

  return new Map(
    plans.map((plan) => {
      const planFacts = facts.find((row) => row.planId === plan.id);

      const phase = planFacts
        ? getCurrentPhaseFromFacts({
            facts: planFacts,
            phaseChallengesRequired:
              planFacts.goalKind !== "language" || (required.get(planFacts.userId) ?? true),
          })
        : null;

      return [plan.id, phase];
    }),
  );
}

/** Lessons, the current phase and the last date, per plan. */
async function loadPlanProgress(plans: readonly PlanRow[]) {
  const planIds = plans.map((plan) => plan.id);

  const [lessons, ends, currentPhases] = await Promise.all([
    prisma.planItem.findMany({ where: { kind: "lesson", planId: { in: planIds } } }),
    prisma.planItem.groupBy({
      _max: { scheduledFor: true },
      by: ["planId"],
      where: { planId: { in: planIds } },
    }),
    loadCurrentPhases(plans),
  ]);

  return { currentPhases, ends, lessons };
}

function toPlanSummary({
  plan,
  progress,
}: {
  plan: PlanRow;
  progress: Awaited<ReturnType<typeof loadPlanProgress>>;
}): GoalView["plan"] {
  const end = progress.ends.find((row) => row.planId === plan.id)?._max.scheduledFor ?? null;
  const phases = parsePlanPhases(plan.phases);

  return {
    currentPhase: progress.currentPhases.get(plan.id) ?? null,
    endDate: end ? toIsoDate(end) : null,
    ...countLessonProgress(progress.lessons.filter((item) => item.planId === plan.id)),
    phaseCount: phases.length,
    ready: phases.length > 0,
  };
}

function toGoalView({
  activeGoalId,
  goal,
  plan,
  progress,
}: {
  activeGoalId: string | null;
  goal: Goal;
  plan: PlanRow | undefined;
  progress: Awaited<ReturnType<typeof loadPlanProgress>>;
}): GoalView {
  return {
    createdAt: goal.createdAt.toISOString(),
    dailyMinutes: goal.dailyMinutes,
    details: isJsonObject(goal.details) ? goal.details : {},
    examBlueprintId: goal.examBlueprintId,
    id: goal.id,
    isActive: goal.id === activeGoalId,
    kind: goal.kind,
    language: goal.language,
    plan: plan ? toPlanSummary({ plan, progress }) : null,
    primaryCourseId: goal.primaryCourseId,
    prompt: goal.prompt,
    status: goal.status,
    studyDays: getStudyDays({ dailyMinutes: goal.dailyMinutes, settings: plan?.settings }),
    studyTime: goal.studyTime,
    targetDate: goal.targetDate ? toIsoDate(goal.targetDate) : null,
    targetLanguage: goal.targetLanguage,
    timezone: goal.timezone,
    title: goal.title,
  };
}

/** Builds the views of a learner's goals with a short summary of each plan. */
export async function loadGoalViews({
  activeGoalId,
  goals,
}: {
  activeGoalId: string | null;
  goals: readonly Goal[];
}): Promise<GoalView[]> {
  const plans = await prisma.plan.findMany({
    select: { goalId: true, id: true, phases: true, settings: true },
    where: { goalId: { in: goals.map((goal) => goal.id) } },
  });

  const progress = await loadPlanProgress(plans);

  return goals.map((goal) =>
    toGoalView({
      activeGoalId,
      goal,
      plan: plans.find((plan) => plan.goalId === goal.id),
      progress,
    }),
  );
}

/**
 * The goal every tab shows (Today, Plan, Progress, Content, Mistakes, the map) and the goal
 * switcher leads with: the one the learner picked, or their first active goal while none is
 * picked yet. Null for a learner without an active goal.
 */
export async function findActiveGoalId(userId: string): Promise<string | null> {
  const profile = await prisma.userLearningProfile.findUnique({
    select: { activeGoalId: true },
    where: { userId },
  });

  if (profile?.activeGoalId) {
    return profile.activeGoalId;
  }

  const first = await prisma.goal.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
    where: { status: "active", userId },
  });

  return first?.id ?? null;
}

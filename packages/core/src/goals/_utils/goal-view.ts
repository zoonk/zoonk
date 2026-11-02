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

function getStudyDays({ dailyMinutes, settings }: { dailyMinutes: number; settings: unknown }) {
  const { weekdayMinutes } = parsePlanSettings(settings);

  return Array.from({ length: DAYS_PER_WEEK }, (_, weekday) => weekday).filter(
    (weekday) => getWeekdayMinutes({ calendar: { dailyMinutes, weekdayMinutes }, weekday }) > 0,
  );
}

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

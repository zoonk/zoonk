import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { chooseNextItem } from "../../plans/_utils/plan-phase-views";
import { getWeekdayMinutes, toIsoDate } from "../../plans/planner/plan-calendar";
import { DAYS_PER_WEEK, parsePlanPhases, parsePlanSettings } from "../../plans/planner/plan-state";
import { type GoalView } from "../goal-contract";

type PlanRow = { goalId: string; id: string; phases: unknown; settings: unknown };

/** The weekdays with study time, from the plan's weekly shape; every day without one. */
function getStudyDays({ dailyMinutes, settings }: { dailyMinutes: number; settings: unknown }) {
  const { weekdayMinutes } = parsePlanSettings(settings);

  return Array.from({ length: DAYS_PER_WEEK }, (_, weekday) => weekday).filter(
    (weekday) => getWeekdayMinutes({ calendar: { dailyMinutes, weekdayMinutes }, weekday }) > 0,
  );
}

/** A stand-in waiting for lessons the Library hasn't outlined yet. */
const WRITING_ITEM = { chapterId: null, kind: "lesson" as const, lessonId: null };

/**
 * `findCurrentPhase` for many plans at once, in SQL: the phase of each plan's next thing to do
 * (`chooseNextItem`), or its last phase once everything is done. Null for a plan without items.
 */
export async function loadCurrentPhases(
  plans: readonly Pick<PlanRow, "id" | "phases">[],
): Promise<Map<string, number | null>> {
  const planIds = plans.map((plan) => plan.id);

  const [withItems, nextWritten, next] = await Promise.all([
    prisma.planItem.groupBy({ by: ["planId"], where: { planId: { in: planIds } } }),
    prisma.planItem.findMany({
      distinct: ["planId"],
      orderBy: [{ planId: "asc" }, { position: "asc" }],
      select: { kind: true, phase: true, planId: true, position: true },
      where: { NOT: WRITING_ITEM, planId: { in: planIds }, status: "todo" },
    }),
    prisma.planItem.findMany({
      distinct: ["planId"],
      orderBy: [{ planId: "asc" }, { position: "asc" }],
      select: { kind: true, phase: true, planId: true, position: true },
      where: { planId: { in: planIds }, status: "todo" },
    }),
  ]);

  return new Map(
    plans.map((plan) => {
      const phaseCount = parsePlanPhases(plan.phases).length;
      const hasItems = withItems.some((row) => row.planId === plan.id);
      const first = next.find((row) => row.planId === plan.id);
      const written = nextWritten.find((row) => row.planId === plan.id);

      const phase = chooseNextItem({
        first,
        written,
        writtenIsLater: written !== undefined && written.position !== first?.position,
      })?.phase;

      const last = hasItems && phaseCount > 0 ? phaseCount - 1 : null;

      return [plan.id, phase ?? last];
    }),
  );
}

/** Lesson counts, the current phase and the last date, per plan. */
async function loadPlanProgress(plans: readonly PlanRow[]) {
  const planIds = plans.map((plan) => plan.id);

  const [counts, ends, currentPhases] = await Promise.all([
    prisma.planItem.groupBy({
      _count: { id: true },
      by: ["planId", "status"],
      where: { kind: "lesson", planId: { in: planIds } },
    }),
    prisma.planItem.groupBy({
      _max: { scheduledFor: true },
      by: ["planId"],
      where: { planId: { in: planIds } },
    }),
    loadCurrentPhases(plans),
  ]);

  return { counts, currentPhases, ends };
}

function toPlanSummary({
  plan,
  progress,
}: {
  plan: PlanRow;
  progress: Awaited<ReturnType<typeof loadPlanProgress>>;
}): GoalView["plan"] {
  const counts = progress.counts.filter((row) => row.planId === plan.id);
  const end = progress.ends.find((row) => row.planId === plan.id)?._max.scheduledFor ?? null;
  const phases = parsePlanPhases(plan.phases);

  return {
    currentPhase: progress.currentPhases.get(plan.id) ?? null,
    endDate: end ? toIsoDate(end) : null,
    lessonsDone: counts
      .filter((row) => row.status !== "todo")
      .reduce((total, row) => total + row._count.id, 0),
    lessonsTotal: counts.reduce((total, row) => total + row._count.id, 0),
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

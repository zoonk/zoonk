import "server-only";
import { type Goal, type PlanSetupTask, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type AnalyticsPlatform } from "../analytics/shared-properties";
import { getNamedMonthStart } from "../exams/_utils/exam-edition-days";
import { getExamCalendarDay, getPlanExamDays } from "../exams/_utils/plan-exam-days";
import { getKeptMonthStart } from "../exams/kept-month";
import { isCourseDateSkipped } from "../view-models/onboarding/onboarding-steps";
import { commitPlan } from "./_utils/commit-plan";
import { type PlanContext } from "./_utils/plan-context";
import { loadPlanAtToken } from "./_utils/plan-token";
import { isPlanUnchanged } from "./_utils/plan-unchanged";
import { ensureQuickBaseLessons, hasQuickBases } from "./_utils/quick-bases";
import { planOnRecommendedBases } from "./_utils/recommended-bases";
import { type ComputedPlan, computePlan } from "./_utils/replan";
import { trackPlanCreated } from "./_utils/track-plan-created";
import { checkNoticeLanding } from "./notice-wait";
import { withPlanRetry } from "./plan-conflict";
import { listPlanSetupTasks, setUpPlanNow } from "./plan-setup";
import { toIsoDate } from "./planner/plan-calendar";
import { type PlanGraph, parsePlanSettings, planGraphSchema } from "./planner/plan-state";
import { getTargetDateBounds } from "./target-date-range";

const MINUTES_PER_HOUR = 60;

type Provenance = { generatedAt: Date; model: string; promptVersion: string; runId: string };

export type GoalPlanCreation = {
  setupTasks: PlanSetupTask[];
  status: "created" | "notFound" | "unchanged";
};

async function keepKnownSkills(graph: PlanGraph): Promise<PlanGraph> {
  const known = await prisma.skill.findMany({
    select: { id: true },
    where: { id: { in: graph.skills.map((skill) => skill.skillId) } },
  });

  const ids = new Set(known.map((skill) => skill.id));
  return { ...graph, skills: graph.skills.filter((skill) => ids.has(skill.skillId)) };
}

type ExamTarget = { asksNotice: boolean; noticeDate: string | null; targetDate: string | null };

async function getExamTarget({
  followNotice,
  goal,
  noticeDate,
  today,
}: {
  followNotice: boolean;
  goal: Goal;
  noticeDate: string | null;
  today: string;
}): Promise<ExamTarget> {
  const goalDate = goal.targetDate ? toIsoDate(goal.targetDate) : null;
  const kept = { asksNotice: false, noticeDate, targetDate: goalDate };

  if (
    isCourseDateSkipped({
      details: isJsonObject(goal.details) ? goal.details : {},
      targetDate: goalDate,
    })
  ) {
    return { asksNotice: false, noticeDate: null, targetDate: null };
  }

  if (goalDate && !(followNotice && goalDate === noticeDate)) {
    return kept;
  }

  if (goal.kind !== "exam") {
    return kept;
  }

  const noticeDay = await findNoticeNextDay({ goal, goalDate });
  const keptMonth = getKeptMonthStart({ details: goal.details, noticeDay, today });
  const latest = getTargetDateBounds(today).max;

  if (keptMonth) {
    return keptMonth <= latest
      ? { asksNotice: true, noticeDate: null, targetDate: keptMonth }
      : kept;
  }

  const next = noticeDay ?? getNamedMonthStart({ details: goal.details, from: today });
  return next && next <= latest ? { asksNotice: false, noticeDate: next, targetDate: next } : kept;
}

async function findNoticeNextDay({
  goal,
  goalDate,
}: {
  goal: Goal;
  goalDate: string | null;
}): Promise<string | null> {
  if (!goal.examBlueprintId) {
    return null;
  }

  const blueprint = await prisma.examBlueprint.findUnique({
    select: { edition: true },
    where: { id: goal.examBlueprintId },
  });

  return (
    getPlanExamDays({
      details: goal.details,
      edition: blueprint?.edition,
      goalDate,
      today: getExamCalendarDay({ edition: blueprint?.edition, now: new Date() }).today,
    }).days[0]?.date ?? null
  );
}

type GraphPlanning = {
  followNotice: boolean;
  goalId: string;
  graph: PlanGraph;
  provenance: Provenance | null;
};

async function planFromGraph({ followNotice, goalId, graph, provenance }: GraphPlanning) {
  const context = await loadPlanAtToken(goalId);

  if (!context) {
    return null;
  }

  const { goal } = context;
  const isFirst = context.state.graph.skills.length === 0;

  const [target, skills] = await Promise.all([
    getExamTarget({
      followNotice,
      goal,
      noticeDate: context.state.settings.noticeDate,
      today: toIsoDate(context.today),
    }),
    keepKnownSkills(graph),
  ]);

  const state = {
    goal: { ...context.state.goal, targetDate: target.targetDate },
    graph: skills,
    settings: { ...context.state.settings, noticeDate: target.noticeDate },
  };

  const planned = await computePlan({ context, mode: "forced", state });

  const computed = isFirst ? await planOnRecommendedBases({ computed: planned, context }) : planned;

  if (!isFirst && isPlanUnchanged({ computed, context })) {
    return { computed, goal, isFirst, status: "unchanged" as const };
  }

  const setupTasks: PlanSetupTask[] = isFirst
    ? ["placement", "routine", ...(target.asksNotice ? (["notice"] as const) : [])]
    : [];

  const plan = { ...provenance, ...(isFirst ? { setupTasks } : {}) };

  await commitPlan({
    change: null,
    computed,
    context,
    extraWrites: async (tx) => {
      if (followNotice) {
        await checkNoticeLanding(tx, context.plan.id);
      }

      if (Object.keys(plan).length > 0) {
        await tx.plan.update({ data: plan, where: { id: context.plan.id } });
      }
    },
  });

  return { computed, goal, isFirst, status: "created" as const };
}

function hasFinishedLessons(context: PlanContext): boolean {
  return context.items.some((item) => item.kind === "lesson" && item.status === "done");
}

async function planAgainFromSaved(goalId: string): Promise<ComputedPlan | null> {
  const saved = await prisma.plan.findUnique({ select: { settings: true }, where: { goalId } });
  const settings = parsePlanSettings(saved?.settings);

  if (hasQuickBases(settings)) {
    await ensureQuickBaseLessons(settings);
  }

  return withPlanRetry(async () => {
    const context = await loadPlanAtToken(goalId);

    if (!(context && (hasQuickBases(context.state.settings) || hasFinishedLessons(context)))) {
      return null;
    }

    const computed = await computePlan({ context, mode: "forced" });

    if (isPlanUnchanged({ computed, context })) {
      return null;
    }

    await commitPlan({ change: null, computed, context });
    return computed;
  });
}

/**
 * Throws a plan conflict (`isPlanConflictError`) when other writes keep landing while it plans, for
 * the caller to try again later. Returns the setup tasks still owed, also when the plan was already
 * built.
 */
export async function createGoalPlan({
  followNotice = false,
  fromPlanLink = false,
  goalId,
  graph,
  platform,
  provenance = null,
  setup = "now",
}: {
  /**
   * The notice was read before the learner saw the plan, so a date taken from it follows its new
   * day.
   */
  followNotice?: boolean;
  fromPlanLink?: boolean;
  goalId: string;
  graph: PlanGraph;
  platform?: AnalyticsPlatform | null;
  provenance?: Provenance | null;
  setup?: "now" | "steps";
}): Promise<GoalPlanCreation> {
  const goal = await prisma.goal.findUnique({ select: { id: true }, where: { id: goalId } });

  if (!goal) {
    return { setupTasks: [], status: "notFound" };
  }

  // Not an upsert: Prisma's upsert reads first, so a concurrent run's insert would fail it.
  await prisma.plan.createMany({ data: [{ goalId }], skipDuplicates: true });

  const built = await withPlanRetry(() =>
    planFromGraph({ followNotice, goalId, graph: planGraphSchema.parse(graph), provenance }),
  );

  if (!built) {
    return { setupTasks: [], status: "notFound" };
  }

  const settled = await planAgainFromSaved(goalId);

  if (built.status === "created" && built.isFirst) {
    const final = settled ?? built.computed;

    await trackPlanCreated({
      estimateHours: final.built.estimate.totalMinutes / MINUTES_PER_HOUR,
      fromPlanLink,
      goal: built.goal,
      phases: final.built.phases.length,
      platform,
    });
  }

  const setupTasks =
    setup === "now" ? await setUpPlanNow(goalId) : await listPlanSetupTasks(goalId);

  return { setupTasks, status: built.status === "created" || settled ? "created" : "unchanged" };
}

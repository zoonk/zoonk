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

/**
 * `unchanged`: the plan was already this one, so nothing was written. `setupTasks`: what the new
 * plan still owes (see `runPlanSetupTask`), in the order they run.
 */
export type GoalPlanCreation = {
  setupTasks: PlanSetupTask[];
  status: "created" | "notFound" | "unchanged";
};

/** Skills the graph names that aren't in the Library can't be planned; they're left out. */
async function keepKnownSkills(graph: PlanGraph): Promise<PlanGraph> {
  const known = await prisma.skill.findMany({
    select: { id: true },
    where: { id: { in: graph.skills.map((skill) => skill.skillId) } },
  });

  const ids = new Set(known.map((skill) => skill.id));
  return { ...graph, skills: graph.skills.filter((skill) => ids.has(skill.skillId)) };
}

/**
 * The date the plan counts down to, and the notice's day it came from, if it did. `asksNotice`:
 * the notice puts the exam in another month than the one the learner named, so its day waits for
 * their answer.
 */
type ExamTarget = { asksNotice: boolean; noticeDate: string | null; targetDate: string | null };

/**
 * An exam goal without a date takes its exam's next day from the stored notice, so the plan
 * counts down to the real day, and remembers it as the notice's (`noticeDate`). The edition is the
 * year the learner named, or the notice's own; a year without its notice yet, or the next edition
 * after a past one, has estimated days, and the plan counts down to the estimated day itself:
 * every screen shows that one date, marked as an estimate. Without a notice day, the month the
 * learner named ("in March") is the date: its first day, kept the same way, so a notice's day
 * replaces it. A notice day in another month than the one they named never replaces it silently:
 * the plan keeps their month as their own date, and the notice's day waits for their answer (see
 * `proposeNoticeChange`), since they may mean a later sitting. A later notice day arrives as a
 * change the learner applies, except with `followNotice` (the notice read before they saw the
 * plan), when a date that was the notice's simply becomes the new one.
 */
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
  // A day past what a plan reaches can't be its date: the goal stays undated, and onboarding asks.
  const latest = getTargetDateBounds(today).max;

  if (keptMonth) {
    return keptMonth <= latest
      ? { asksNotice: true, noticeDate: null, targetDate: keptMonth }
      : kept;
  }

  const next = noticeDay ?? getNamedMonthStart({ details: goal.details, from: today });
  return next && next <= latest ? { asksNotice: false, noticeDate: next, targetDate: next } : kept;
}

/**
 * The exam's next day after today in its own zone, of the sitting the learner means (see
 * `findMeantExamDay`): the one of the date the plan took from the notice (`goalDate`), else of the
 * month they named, else the next one. Public course days use the same cutoff, independent of
 * the learner's study timezone. Null without one.
 */
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

/**
 * The plan from the graph, read after the plan's token (see `loadPlanAtToken`), so a change that
 * lands while it's worked out fails its save, and the caller plans again. The first plan starts
 * on the recommendation for its bases, creating nothing (see `planOnRecommendedBases`), and owes
 * its setup. A rebuilt plan that comes out the same writes nothing. With `followNotice`, the plan
 * still has to wait for the notice's reading when it's saved (see `checkNoticeLanding`).
 */
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

  // A new plan starts on the recommendation for its bases; a rebuilt one keeps the learner's.
  const computed = isFirst ? await planOnRecommendedBases({ computed: planned, context }) : planned;

  if (!isFirst && isPlanUnchanged({ computed, context })) {
    return { computed, goal, isFirst, status: "unchanged" as const };
  }

  // A new plan owes its setup from the moment it's saved. A notice read later proposes its day
  // when that reading lands (the research workflow's reconciliation).
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

/** Whether the learner finished lessons of the plan before it existed (see `savePlanItems`). */
function hasFinishedLessons(context: PlanContext): boolean {
  return context.items.some((item) => item.kind === "lesson" && item.status === "done");
}

/**
 * The saved plan planned again from what it has now, once more is known than when it was worked
 * out: the quick lessons its bases are studied with, created here (outlines, no model call), and
 * the lessons the learner finished before it existed, now checked off (a guest's lesson's chapter
 * is in progress, so its next lesson comes first, R10). Planned from the plan as it is, the
 * learner's choices, date and time included, without recommending its bases again. Runs after
 * every build, so a run that stopped before it, or a quick lesson another learner's run created
 * first, still ends with the plan they make. Writes nothing when the plan already is so; null when
 * it wrote nothing.
 */
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
 * Builds a goal's plan from its skill graph: the phases, and the goal's skills in teaching order
 * with their size, area and exam weight. The Library's lessons for those skills fill the plan,
 * with dates at the learner's time; skills not outlined yet stand as one item each until their
 * lessons exist. Running it again replaces the graph and re-plans from today, keeping past work;
 * a run that changes nothing writes nothing (`unchanged`). The plan is worked out outside any
 * lock and saved only if nothing it reads changed meanwhile (see `loadPlanAtToken`): planned again
 * once when something did, then it throws (see `isPlanConflictError`), for the caller to try again
 * later, as lessons and questions other runs save for the same skills can keep landing for a while.
 * Once saved, it's planned again with the quick lessons its bases are studied with and the lessons
 * finished before it existed (see `planAgainFromSaved`).
 * The first plan of a goal sends "Plan Created" and owes its setup, each task once (see
 * `runPlanSetupTask`): testing out what placement already settled when the learner ended it before
 * the plan existed, fitting it to the routine memory holds (days off, lighter days, trips) as a
 * change the learner sees with an undo, and, when it keeps the month the learner named over a
 * notice day in another month, the notice's day waiting on Today. A request sets the plan up
 * before it returns (`setup: "now"`), leaving a task that failed owed for the goal's next run; a
 * workflow runs each task as a step of its own (`setup: "steps"`). Returns the tasks still owed,
 * also when the plan was already built, so a run that stopped after saving it still sets it up.
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
   * The exam's notice was read before the learner saw the plan: a date the plan took from the
   * notice follows its new day instead of waiting for the learner's OK.
   */
  followNotice?: boolean;
  /** The plan copies someone's shared plan instead of a new skill graph. */
  fromPlanLink?: boolean;
  goalId: string;
  graph: PlanGraph;
  /** The client that started the work, for "Plan Created"; omitted, it's read from the request. */
  platform?: AnalyticsPlatform | null;
  provenance?: Provenance | null;
  /** A new plan's setup: run in this call, or left for the caller's steps (`runPlanSetupTask`). */
  setup?: "now" | "steps";
}): Promise<GoalPlanCreation> {
  const goal = await prisma.goal.findUnique({ select: { id: true }, where: { id: goalId } });

  if (!goal) {
    return { setupTasks: [], status: "notFound" };
  }

  // The empty plan is saved first and on its own, so a run that fails still leaves it. One
  // statement that waits for another run saving it instead of failing on it (an upsert that
  // updates nothing reads first, then inserts).
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

  // A run that saved the plan, then stopped before setting it up, still sets it up when it runs
  // again: the tasks it owes are the plan's.
  const setupTasks =
    setup === "now" ? await setUpPlanNow(goalId) : await listPlanSetupTasks(goalId);

  return { setupTasks, status: built.status === "created" || settled ? "created" : "unchanged" };
}

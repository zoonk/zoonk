import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { type AnalyticsPlatform } from "../analytics/shared-properties";
import {
  getExamEditionDays,
  getNamedMonthStart,
  readExamMonth,
  readExamYear,
} from "../exams/_utils/exam-edition-days";
import { applyPlacementToNewPlan } from "../learner/placement/_utils/apply-placement";
import { examEditionSchema } from "../library/exams/blueprint-contract";
import { fitPlanToRoutine } from "./_utils/fit-plan-to-routine";
import { loadPlanContext } from "./_utils/plan-context";
import { commitPlan, computePlan, isPlanUnchanged, withPlanRetry } from "./_utils/replan";
import { trackPlanCreated } from "./_utils/track-plan-created";
import { proposeNoticeChange } from "./notice-plan-change";
import { toIsoDate } from "./planner/plan-calendar";
import { type PlanGraph, planGraphSchema } from "./planner/plan-state";

const MINUTES_PER_HOUR = 60;

type Provenance = { generatedAt: Date; model: string; promptVersion: string; runId: string };

/** `unchanged`: the plan was already this one, so nothing was written. */
export type GoalPlanCreation = { status: "created" | "notFound" | "unchanged" };

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

const MONTH_LENGTH = "YYYY-MM".length;

/**
 * An exam goal without a date takes its exam's next day from the stored notice, so the plan
 * counts down to the real day, and remembers it as the notice's (`noticeDate`). The edition is the
 * year the learner named, or the notice's own; a year without its notice yet, or the next edition
 * after a past one, has estimated days, and the plan counts down to the estimated day itself:
 * every screen shows that one date, marked as an estimate. Without a notice day, the month the
 * learner named ("em março") is the date: its first day, kept the same way, so a notice's day
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

  if (goalDate && !(followNotice && goalDate === noticeDate)) {
    return kept;
  }

  if (goal.kind !== "exam") {
    return kept;
  }

  const named = getNamedMonthStart({ details: goal.details, from: today });
  const noticeDay = await findNoticeNextDay({ goal, today });

  if (named && noticeDay && named.slice(0, MONTH_LENGTH) !== noticeDay.slice(0, MONTH_LENGTH)) {
    return { asksNotice: true, noticeDate: null, targetDate: named };
  }

  const next = noticeDay ?? named;
  return next ? { asksNotice: false, noticeDate: next, targetDate: next } : kept;
}

/** The exam's next day after `today` in its stored notice; null without one. */
async function findNoticeNextDay({
  goal,
  today,
}: {
  goal: Goal;
  today: string;
}): Promise<string | null> {
  if (!goal.examBlueprintId) {
    return null;
  }

  const blueprint = await prisma.examBlueprint.findUnique({
    select: { edition: true },
    where: { id: goal.examBlueprintId },
  });

  const { days } = getExamEditionDays({
    edition: examEditionSchema.safeParse(blueprint?.edition).data ?? null,
    examMonth: readExamMonth(goal.details),
    examYear: readExamYear(goal.details),
    from: today,
  });

  return days.find((day) => day.date > today)?.date ?? null;
}

/** A plan still works without placement's test-outs, so a failure only logs. */
async function placeNewPlan(goal: Goal): Promise<void> {
  const { error } = await safeAsync(() => applyPlacementToNewPlan(goal));

  if (error) {
    logError("[createGoalPlan] Could not apply placement to the new plan:", error);
  }
}

/** A plan still works without fitting it to the routine, so a failed model call only logs. */
async function fitToRoutine(goalId: string): Promise<void> {
  const { error } = await safeAsync(() => fitPlanToRoutine(goalId));

  if (error) {
    logError("[createGoalPlan] Could not fit the plan to the learner's routine:", error);
  }
}

/**
 * The notice's day in another month than the learner named waits on Today for their answer
 * (Apply or "Keep mine"). The plan works with their month meanwhile, so a failure only logs.
 */
async function askAboutNoticeDay(goalId: string): Promise<void> {
  const { error } = await safeAsync(() => proposeNoticeChange({ goalId }));

  if (error) {
    logError("[createGoalPlan] Could not propose the notice's exam day:", error);
  }
}

/**
 * Builds a goal's plan from its skill graph: the phases, and the goal's skills in teaching order
 * with their size, area and exam weight. The Library's lessons for those skills fill the plan,
 * with dates at the learner's time; skills not outlined yet stand as one item each until their
 * lessons exist. Running it again replaces the graph and re-plans from today, keeping past work;
 * a run that changes nothing writes nothing (`unchanged`).
 * The first plan of a goal sends "Plan Created", tests out what placement already settled when the
 * learner ended it before the plan existed, and is fitted to the routine memory holds (days off,
 * lighter days, trips), as a change the learner sees with an undo. When it keeps the month the
 * learner named over a notice day in another month, the notice's day waits on Today.
 */
export async function createGoalPlan({
  followNotice = false,
  fromPlanLink = false,
  goalId,
  graph,
  platform,
  provenance = null,
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
}): Promise<GoalPlanCreation> {
  const parsed = planGraphSchema.parse(graph);

  const outcome = await withPlanRetry(async () => {
    const goal = await prisma.goal.findUnique({ where: { id: goalId } });

    if (!goal) {
      return { status: "notFound" as const };
    }

    await prisma.plan.upsert({ create: { goalId }, update: {}, where: { goalId } });

    const context = await loadPlanContext({ goal });

    if (!context) {
      return { status: "notFound" as const };
    }

    const today = toIsoDate(context.today);
    const isFirst = context.state.graph.skills.length === 0;

    const target = await getExamTarget({
      followNotice,
      goal,
      noticeDate: context.state.settings.noticeDate,
      today,
    });

    const state = {
      goal: { ...context.state.goal, targetDate: target.targetDate },
      graph: await keepKnownSkills(parsed),
      settings: { ...context.state.settings, noticeDate: target.noticeDate },
    };

    const computed = await computePlan({ context, mode: "forced", state });

    if (!isFirst && isPlanUnchanged({ computed, context })) {
      return { status: "unchanged" as const };
    }

    await commitPlan({
      change: null,
      computed,
      context,
      extraWrites: provenance
        ? (tx) => tx.plan.update({ data: provenance, where: { id: context.plan.id } })
        : undefined,
    });

    return { asksNotice: target.asksNotice, computed, goal, isFirst, status: "created" as const };
  });

  if (outcome.status === "created" && outcome.isFirst) {
    // Before the routine's fit: both re-plan, and the fit then starts from what's left to study.
    await placeNewPlan(outcome.goal);

    await Promise.all([
      trackPlanCreated({
        estimateHours: outcome.computed.built.estimate.totalMinutes / MINUTES_PER_HOUR,
        fromPlanLink,
        goal: outcome.goal,
        phases: outcome.computed.built.phases.length,
        platform,
      }),
      fitToRoutine(goalId),
    ]);

    // Last, so its effect reads the plan the learner gets. A notice read later proposes its day
    // when that reading lands (the research workflow's reconciliation).
    if (outcome.asksNotice) {
      await askAboutNoticeDay(goalId);
    }
  }

  return { status: outcome.status };
}

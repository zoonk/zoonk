import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { type AnalyticsPlatform } from "../analytics/shared-properties";
import {
  type EditionExamDays,
  getExamEditionDays,
  readExamYear,
} from "../exams/_utils/exam-edition-days";
import { examEditionSchema } from "../library/exams/blueprint-contract";
import { fitPlanToRoutine } from "./_utils/fit-plan-to-routine";
import { loadPlanContext } from "./_utils/plan-context";
import { commitPlan, computePlan, withPlanRetry } from "./_utils/replan";
import { trackPlanCreated } from "./_utils/track-plan-created";
import { addDays, fromIsoDate, toIsoDate } from "./planner/plan-calendar";
import { type PlanGraph, planGraphSchema } from "./planner/plan-state";

const MINUTES_PER_HOUR = 60;

/**
 * An estimated exam day can land a week off either way (ENEM's first day was November 3 in 2024,
 * the 9th in 2025 and the 8th in 2026), so a plan for an estimate aims to be ready two weeks
 * before it: ENEM 2028, estimated for November 12, by October 29.
 */
const READY_BEFORE_ESTIMATE_DAYS = 14;

type Provenance = { generatedAt: Date; model: string; promptVersion: string; runId: string };

export type GoalPlanCreation = { status: "created" | "notFound" };

/** Skills the graph names that aren't in the Library can't be planned; they're left out. */
async function keepKnownSkills(graph: PlanGraph): Promise<PlanGraph> {
  const known = await prisma.skill.findMany({
    select: { id: true },
    where: { id: { in: graph.skills.map((skill) => skill.skillId) } },
  });

  const ids = new Set(known.map((skill) => skill.id));
  return { ...graph, skills: graph.skills.filter((skill) => ids.has(skill.skillId)) };
}

/** The exam's next day, or two weeks before it when the day is only an estimate. */
function getReadyDate({ days, estimated, today }: EditionExamDays & { today: string }) {
  const next = days.find((day) => day.date > today)?.date ?? null;

  if (!next || !estimated) {
    return next;
  }

  const early = toIsoDate(addDays(fromIsoDate(next), -READY_BEFORE_ESTIMATE_DAYS));
  return early > today ? early : next;
}

/**
 * An exam goal without a date takes its exam's next day from the stored notice, so the plan
 * counts down to the real day. The edition is the year the learner named, or the notice's own; a
 * year without its notice yet, or the next edition after a past one, has estimated days, and the
 * plan aims to be ready before them.
 */
async function getExamTargetDate({
  goal,
  today,
}: {
  goal: Goal;
  today: string;
}): Promise<string | null> {
  if (goal.targetDate) {
    return toIsoDate(goal.targetDate);
  }

  if (goal.kind !== "exam" || !goal.examBlueprintId) {
    return null;
  }

  const blueprint = await prisma.examBlueprint.findUnique({
    select: { edition: true },
    where: { id: goal.examBlueprintId },
  });

  const editionDays = getExamEditionDays({
    edition: examEditionSchema.safeParse(blueprint?.edition).data ?? null,
    examYear: readExamYear(goal.details),
    from: today,
  });

  return getReadyDate({ ...editionDays, today });
}

/** A plan still works without fitting it to the routine, so a failed model call only logs. */
async function fitToRoutine(goalId: string): Promise<void> {
  const { error } = await safeAsync(() => fitPlanToRoutine(goalId));

  if (error) {
    logError("[createGoalPlan] Could not fit the plan to the learner's routine:", error);
  }
}

/**
 * Builds a goal's plan from its skill graph: the phases, and the goal's skills in teaching order
 * with their size, area and exam weight. The Library's lessons for those skills fill the plan,
 * with dates at the learner's time; skills not outlined yet stand as one item each until their
 * lessons exist. Running it again replaces the graph and re-plans from today, keeping past work.
 * The first plan of a goal sends "Plan Created" and is fitted to the routine memory holds (days
 * off, lighter days, trips), as a change the learner sees with an undo.
 */
export async function createGoalPlan({
  fromPlanLink = false,
  goalId,
  graph,
  platform,
  provenance = null,
}: {
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

    const state = {
      goal: { ...context.state.goal, targetDate: await getExamTargetDate({ goal, today }) },
      graph: await keepKnownSkills(parsed),
      settings: context.state.settings,
    };

    const computed = await computePlan({ context, mode: "forced", state });

    await commitPlan({
      change: null,
      computed,
      context,
      extraWrites: provenance
        ? (tx) => tx.plan.update({ data: provenance, where: { id: context.plan.id } })
        : undefined,
    });

    return { computed, goal, isFirst, status: "created" as const };
  });

  if (outcome.status === "created" && outcome.isFirst) {
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
  }

  return { status: outcome.status };
}

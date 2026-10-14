import "server-only";
import {
  type GoalTutorLookUpRequest,
  type GoalTutorLookUpResult,
} from "@zoonk/ai/tasks/v2/tutor/goal-tutor-lookup";
import { type PlanLookUp } from "@zoonk/ai/tasks/v2/tutor/goal-tutor-lookup-plan";
import { type Goal, type PlanItem, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { z } from "zod";
import { getAnswerTimeZone } from "../../../learner/_utils/owned-goal";
import {
  type SkillAreas,
  getSkillAreas,
  getWritingTitle,
  isWritingItem,
} from "../../../plans/_utils/plan-phase-views";
import { getGoalPlan } from "../../../plans/get-goal-plan";
import { type PlanPhaseView, type PlanView } from "../../../plans/plan-view-contract";
import { addDays, fromIsoDate, toIsoDate } from "../../../plans/planner/plan-calendar";
import { parsePlanGraph } from "../../../plans/planner/plan-state";
import {
  type LinkScope,
  loadCatchUp,
  loadSavedDay,
  toChallengeLink,
  toPlusMark,
} from "../plan-day-context";

/** Enough lessons to go over in one answer; the rest only count (`more`). */
const MAX_CATCH_UP_LESSONS = 30;

/** Two weeks: enough for "what's next week", never the whole plan at once. */
const SCHEDULE_DAYS = 14;

/** A day's items listed; the rest only count (`moreItems`). */
const MAX_DAY_ITEMS = 8;

/** The plan as the apps show it, read only, once it's built; null before. */
async function readPlanView(goalId: string): Promise<PlanView | null> {
  const result = await getGoalPlan(goalId);
  return result.status === "ready" && result.plan.ready ? result.plan : null;
}

/**
 * Every lesson earlier days left, past the first few the context lists, from the same rows the
 * plan's status counts (`loadCatchUpItems`), in the plan's order: each linked as the context links
 * it, to today's block when the day holds it and to Today otherwise. No original day: the plan
 * keeps only that earlier days left them. A free exam plan past its first week has none.
 */
async function lookUpCatchUp({
  goal,
  scope,
}: {
  goal: Goal;
  scope: LinkScope;
}): Promise<GoalTutorLookUpResult> {
  const what = "catchUp";
  const [plan, day] = await Promise.all([readPlanView(goal.id), loadSavedDay(goal)]);

  const catchUp = plan
    ? await loadCatchUp({ day, goal, limit: MAX_CATCH_UP_LESSONS, plan, scope })
    : null;

  return catchUp ? { ...catchUp, status: "found", what } : { status: "notFound", what };
}

/**
 * The first day a schedule reads: the day the buddy asked for when it's a real one, never before
 * tomorrow (today is in the context, and past days aren't ahead).
 */
function getScheduleStart({ query, tomorrow }: { query: string | null; tomorrow: Date }): Date {
  const asked = z.iso.date().safeParse(query);
  const start = asked.success ? fromIsoDate(asked.data) : tomorrow;

  return start > tomorrow ? start : tomorrow;
}

/** How a day's items read: the minutes the Plan's week gives them, its access and each subject. */
type ScheduleSources = {
  minutes: ReadonlyMap<string, number | null>;
  plan: PlanView;
  skillAreas: SkillAreas;
};

/** A plan item on a day ahead: a stand-in by its subject, as the Plan names it. */
function toScheduledItem({
  item,
  minutes,
  plan,
  skillAreas,
}: ScheduleSources & { item: PlanItem }) {
  const writing = isWritingItem(item);

  return {
    kind: item.kind,
    link: toChallengeLink(item),
    minutes: minutes.get(item.id) ?? null,
    ...toPlusMark({ kind: item.kind, requiresPlus: plan.access.mocksRequirePlus }),
    status: item.status,
    title: writing ? getWritingTitle({ item, skillAreas }) : item.titleSnapshot,
    ...(writing && { writing: true as const }),
  };
}

/** A day ahead with its first items; past a free exam plan's first week, it comes with Plus. */
function toScheduleDay({
  date,
  items,
  ...sources
}: ScheduleSources & { date: string; items: PlanItem[] }) {
  const { freeUntil } = sources.plan.access;
  const shown = items.slice(0, MAX_DAY_ITEMS);

  return {
    date,
    items: shown.map((item) => toScheduledItem({ ...sources, item })),
    moreItems: items.length - shown.length,
    ...(freeUntil !== null && date > freeUntil && { plusRequired: true as const }),
  };
}

/**
 * The plan's study days ahead as it saved them, from the day `query` names (tomorrow when it names
 * none) through two weeks: each day's items in the plan's order, a few per day. Minutes come from
 * the Plan's own week, the only days it estimates. Days are the learner's own, as the plan stores
 * them; nothing here plans them again.
 */
async function lookUpSchedule({
  goal,
  query,
}: {
  goal: Goal;
  query: string | null;
}): Promise<GoalTutorLookUpResult> {
  const what = "schedule";

  const today = getDateInTimeZone({ date: new Date(), timeZone: getAnswerTimeZone({ goal }) });
  const from = getScheduleStart({ query, tomorrow: addDays(today, 1) });
  const to = addDays(from, SCHEDULE_DAYS - 1);

  const [plan, saved] = await Promise.all([
    readPlanView(goal.id),
    prisma.plan.findUnique({
      select: {
        graph: true,
        items: {
          orderBy: [{ scheduledFor: "asc" }, { position: "asc" }],
          where: { scheduledFor: { gte: from, lte: to } },
        },
      },
      where: { goalId: goal.id },
    }),
  ]);

  if (!plan || !saved || saved.items.length === 0) {
    return { status: "notFound", what };
  }

  const sources: ScheduleSources = {
    minutes: new Map(
      plan.week.days.flatMap((day) => day.items.map((item) => [item.id, item.minutes] as const)),
    ),
    plan,
    skillAreas: getSkillAreas({
      courseTitle: plan.course?.title ?? null,
      skills: parsePlanGraph(saved.graph).skills,
    }),
  };

  const days = Map.groupBy(saved.items, (item) =>
    item.scheduledFor ? toIsoDate(item.scheduledFor) : null,
  );

  return {
    days: [...days].flatMap(([date, items]) =>
      date ? [toScheduleDay({ ...sources, date, items })] : [],
    ),
    from: toIsoDate(from),
    status: "found",
    to: toIsoDate(to),
    what,
  };
}

/** A challenge's phase, as the Plan names it: an exam's phases have no name, only their kind. */
function toChallengePhase(phase: PlanPhaseView | undefined) {
  return phase ? { index: phase.index, kind: phase.kind, name: phase.name || null } : null;
}

/** A mock still to take on its planned day, locked as the Plan locks mocks; none without a day. */
function toPlannedMock({ mock, plan }: { mock: PlanItem; plan: PlanView }) {
  if (mock.status !== "todo" || !mock.scheduledFor) {
    return [];
  }

  return [
    {
      date: toIsoDate(mock.scheduledFor),
      kind: "mock" as const,
      link: { kind: "challenge" as const, planItemId: mock.id },
      locked: plan.access.mocksRequirePlus,
      phase: toChallengePhase(plan.phases.find((phase) => phase.index === mock.phase)),
      when: "date" as const,
    },
  ];
}

/**
 * Every phase challenge still ahead, as the Plan shows when it comes and whether it's locked, then
 * every planned mock still to take by its day; and how many of each the learner already did. Their
 * pages open them, whatever goal is open.
 */
async function lookUpChallenges(goal: Goal): Promise<GoalTutorLookUpResult> {
  const what = "challenges";

  const [plan, mocks] = await Promise.all([
    readPlanView(goal.id),
    prisma.planItem.findMany({
      orderBy: [{ scheduledFor: "asc" }, { position: "asc" }],
      where: { kind: "mock", plan: { goalId: goal.id }, status: { in: ["done", "todo"] } },
    }),
  ]);

  if (!plan) {
    return { status: "notFound", what };
  }

  const checkpoints = plan.phases.flatMap((phase) =>
    phase.checkpoint ? [{ checkpoint: phase.checkpoint, phase }] : [],
  );

  const challenges = checkpoints
    .filter(({ checkpoint }) => checkpoint.state === "upcoming")
    .map(({ checkpoint, phase }) => ({
      date: checkpoint.date,
      kind: "challenge" as const,
      link: { kind: "challenge" as const, planItemId: checkpoint.planItemId },
      locked: checkpoint.locked,
      phase: toChallengePhase(phase),
      when: checkpoint.when,
    }));

  const plannedMocks = mocks.flatMap((mock) => toPlannedMock({ mock, plan }));

  const done = {
    challenges: checkpoints.filter(({ checkpoint }) => checkpoint.state === "done").length,
    mocks: mocks.filter((mock) => mock.status === "done").length,
  };

  const ahead = [...challenges, ...plannedMocks];

  if (ahead.length === 0 && done.challenges === 0 && done.mocks === 0) {
    return { status: "notFound", what };
  }

  return { challenges: ahead, done, status: "found", what };
}

/**
 * Reads what a plan lookup asks for (`PLAN_LOOKUPS`) from the learner's own goal: only the goal the
 * answer is about, which `lookUpTutorData` resolved from the signed-in learner's question.
 */
export function lookUpPlanData({
  goal,
  linkScope,
  query,
  what,
}: Pick<GoalTutorLookUpRequest, "area" | "query"> & {
  goal: Goal;
  /** What its results may link (see `LinkScope`): what acts on the open goal only when allowed. */
  linkScope: LinkScope;
  what: PlanLookUp;
}): Promise<GoalTutorLookUpResult> {
  switch (what) {
    case "catchUp":
      return lookUpCatchUp({ goal, scope: linkScope });
    case "challenges":
      return lookUpChallenges(goal);
    case "schedule":
      return lookUpSchedule({ goal, query });
    default:
      return what satisfies never;
  }
}

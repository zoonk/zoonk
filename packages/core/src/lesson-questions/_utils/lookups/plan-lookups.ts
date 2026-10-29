import {
  type GoalTutorLookUpRequest,
  type GoalTutorLookUpResult,
} from "@zoonk/ai/tasks/v2/tutor/goal-tutor-lookup";
import "server-only";
import { type PlanLookUp } from "@zoonk/ai/tasks/v2/tutor/goal-tutor-lookup-plan";
import { type Goal, type PlanItem, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { z } from "zod";
import { WEEKLY_CHALLENGE_KINDS } from "../../../checkpoints/_utils/load-weekly-challenge";
import { getAnswerTimeZone } from "../../../learner/_utils/owned-goal";
import {
  type SkillAreas,
  getSkillAreas,
  getWritingTitle,
} from "../../../plans/_utils/plan-phase-views";
import { getGoalPlan } from "../../../plans/get-goal-plan";
import { findPlanTimeToCover } from "../../../plans/get-time-advice";
import { type PlanPhaseView, type PlanView } from "../../../plans/plan-view-contract";
import { addDays, fromIsoDate, toIsoDate } from "../../../plans/planner/plan-calendar";
import { isWritingItem } from "../../../plans/planner/plan-item-rules";
import { parsePlanGraph } from "../../../plans/planner/plan-state";
import {
  type LinkScope,
  loadCatchUp,
  loadSavedDay,
  toChallengeLink,
  toPlusMark,
  toWeeklyChallenge,
} from "../plan-day-context";

const MAX_CATCH_UP_LESSONS = 30;

const SCHEDULE_DAYS = 14;

const MAX_DAY_ITEMS = 8;

const MAX_WEEKLY_CHALLENGES = 8;

async function readPlanView(goalId: string): Promise<PlanView | null> {
  const result = await getGoalPlan(goalId);
  return result.status === "ready" && result.plan.ready ? result.plan : null;
}

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

/** Ahead begins after the session Today opens, which may still be yesterday's carried session. */
async function getScheduleStart({ goal, query }: { goal: Goal; query: string | null }) {
  const day = await loadSavedDay(goal);

  const shown =
    day?.session.localDate ??
    getDateInTimeZone({ date: new Date(), timeZone: getAnswerTimeZone({ goal }) });

  const first = addDays(shown, 1);
  const asked = z.iso.date().safeParse(query);
  const start = asked.success ? fromIsoDate(asked.data) : first;

  return start > first ? start : first;
}

type ScheduleSources = {
  minutes: ReadonlyMap<string, number | null>;
  plan: PlanView;
  skillAreas: SkillAreas;
};

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

/** Read-only; uses saved learner-local dates and returns at most two weeks. */
async function lookUpSchedule({
  goal,
  query,
}: {
  goal: Goal;
  query: string | null;
}): Promise<GoalTutorLookUpResult> {
  const what = "schedule";
  const from = await getScheduleStart({ goal, query });
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
      plan.week.days.flatMap((day) =>
        day.items.flatMap((item) => (item.id ? [[item.id, item.minutes] as const] : [])),
      ),
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

function toChallengePhase(phase: PlanPhaseView | undefined) {
  return phase ? { index: phase.index, kind: phase.kind, name: phase.name || null } : null;
}

/** Challenge links remain valid regardless of the currently open goal. */
async function lookUpChallenges(goal: Goal): Promise<GoalTutorLookUpResult> {
  const what = "challenges";

  const [plan, weekly] = await Promise.all([
    readPlanView(goal.id),
    prisma.planItem.findMany({
      orderBy: [{ scheduledFor: "asc" }, { position: "asc" }],
      where: {
        kind: { in: [...WEEKLY_CHALLENGE_KINDS] },
        plan: { goalId: goal.id },
        status: { in: ["done", "todo"] },
      },
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
      link: toChallengeLink({ id: checkpoint.planItemId, kind: "boss" }),
      locked: checkpoint.locked,
      phase: toChallengePhase(phase),
      when: checkpoint.when,
    }));

  const planned = weekly.filter((item) => item.status === "todo" && item.scheduledFor);

  const shown = planned
    .slice(0, MAX_WEEKLY_CHALLENGES)
    .map((item) => ({
      ...toWeeklyChallenge({ item, plan }),
      phase: toChallengePhase(plan.phases.find((phase) => phase.index === item.phase)),
    }));

  const done = {
    challenges: checkpoints.filter(({ checkpoint }) => checkpoint.state === "done").length,
    mocks: weekly.filter((item) => item.kind === "mock" && item.status === "done").length,
    weekly: weekly.filter((item) => item.kind !== "mock" && item.status === "done").length,
  };

  const ahead = [...challenges, ...shown];

  if (ahead.length === 0 && done.challenges + done.mocks + done.weekly === 0) {
    return { status: "notFound", what };
  }

  return { challenges: ahead, done, more: planned.length - shown.length, status: "found", what };
}

/** Runs the planner only for an explicit time-to-cover lookup; unavailable without a date or built plan. */
async function lookUpTimeToCover(goal: Goal): Promise<GoalTutorLookUpResult> {
  const what = "timeToCover";
  const result = await findPlanTimeToCover({ goalId: goal.id, input: {} });

  if (result.status !== "ready" || !result.time.ready || !result.time.targetDate) {
    return { status: "notFound", what };
  }

  const { coreMinutes, fittingDate, recommendedMinutes, targetDate } = result.time;

  return { coreMinutes, fittingDate, recommendedMinutes, status: "found", targetDate, what };
}

/** goal must be resolved from the signed-in learner's question, never caller-selected. */
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
    case "timeToCover":
      return lookUpTimeToCover(goal);
    default:
      return what satisfies never;
  }
}

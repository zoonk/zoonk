import "server-only";
import { type PlanItem, type StudyFreshStart, type StudySessionBlock, prisma } from "@zoonk/db";
import { parsePlanChangePayload } from "../../plans/_utils/plan-change-payload";
import { readBlockPayload } from "../block-payload";
import { type PlannedLesson } from "../session-builder";
import { loadPlanLessons } from "./load-plan-lessons";
import { type CatchUpView } from "./session-view";

const LEARN_KINDS: PlanItem["kind"][] = ["lesson", "chapter"];

/**
 * Catching up today is offered while it takes about one more day of the learner's daily time: a
 * quarter over still counts. Past that the next days take it on their own (they open with it): a
 * free learner was offered "+712 min", and tapping it made a 207-block day.
 */
const CATCH_UP_DAY_SHARE = 1.25;

/**
 * The lessons earlier days left that the learner hasn't done yet: what the plan's last new-day
 * settling carried first (see `refreshGoalPlan`), still to do. Empty when the learner is on pace.
 * A stand-in for lessons not outlined yet isn't one: no day can hold it, so counting it said "5
 * lessons to catch up" over Carla's 4.
 */
export async function loadCatchUpItems(goalId: string | null): Promise<PlanItem[]> {
  if (!goalId) {
    return [];
  }

  const settled = await prisma.planChange.findFirst({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    where: { kind: "missedDays", plan: { goalId } },
  });

  const { carriedItemIds } = parsePlanChangePayload(settled?.payload);

  if (carriedItemIds.length === 0) {
    return [];
  }

  return prisma.planItem.findMany({
    orderBy: { position: "asc" },
    where: {
      OR: [{ lessonId: { not: null } }, { chapterId: { not: null } }],
      id: { in: carriedItemIds },
      kind: { in: LEARN_KINDS },
      status: "todo",
    },
  });
}

/** Whether a day's block is one of the lessons earlier days left. */
function isCatchingUp({
  block,
  items,
}: {
  block: StudySessionBlock;
  items: readonly PlanItem[];
}): boolean {
  const { planItemId } = readBlockPayload(block);

  return (
    block.kind === "learn" &&
    items.some(
      (item) =>
        item.id === planItemId || (item.lessonId !== null && item.lessonId === block.lessonId),
    )
  );
}

/**
 * The lessons earlier days left that a day doesn't hold yet, as the day would take them: what
 * "catch up today" adds.
 */
export async function loadLaterCatchUp({
  blocks,
  goalId,
  userId,
}: {
  blocks: readonly StudySessionBlock[];
  goalId: string | null;
  userId: string;
}): Promise<{ items: PlanItem[]; lessons: PlannedLesson[] }> {
  const items = await loadCatchUpItems(goalId);

  const inDay = new Set(
    items.filter((item) => blocks.some((block) => isCatchingUp({ block, items: [item] }))),
  );

  const later = items.filter((item) => !inDay.has(item));

  return {
    items,
    lessons: later.length > 0 ? await loadPlanLessons({ items: later, userId }) : [],
  };
}

/** Whether adding what's left to catch up to today takes about one more day's time at most. */
function fitsInADay({ dailyMinutes, minutes }: { dailyMinutes: number; minutes: number }) {
  return minutes > 0 && minutes <= dailyMinutes * CATCH_UP_DAY_SHARE;
}

/**
 * Whether the day says nothing about catching up: a fresh start carries no backlog (a welcome
 * back's lighter day, a new phase or week: its lessons are just the next ones), except on the day
 * before an exam, which has no next days to take them, and a free exam plan past its first week
 * has no new lessons to catch up on.
 */
function isQuietDay({
  examTomorrow,
  freshStart,
  trialEnded,
}: {
  examTomorrow: boolean;
  freshStart: StudyFreshStart | null;
  trialEnded: boolean;
}): boolean {
  return trialEnded || (freshStart !== null && !examTomorrow);
}

/** Where catching up stands on a day (see `CatchUpView`); null when the learner is on pace. */
export async function loadCatchUpView({
  blocks,
  dailyMinutes,
  examTomorrow,
  freshStart,
  goalId,
  trialEnded,
  userId,
}: {
  blocks: readonly StudySessionBlock[];
  /** The learner's daily time for the goal: what "about one more day" measures. */
  dailyMinutes: number;
  examTomorrow: boolean;
  freshStart: StudyFreshStart | null;
  goalId: string | null;
  trialEnded: boolean;
  userId: string;
}): Promise<CatchUpView | null> {
  if (isQuietDay({ examTomorrow, freshStart, trialEnded })) {
    return null;
  }

  const { items, lessons } = await loadLaterCatchUp({ blocks, goalId, userId });

  if (items.length === 0) {
    return null;
  }

  const minutes = Math.round(lessons.reduce((total, lesson) => total + lesson.minutes, 0));

  return {
    blockIds: blocks.filter((block) => isCatchingUp({ block, items })).map((block) => block.id),
    later: { lessons: lessons.length, minutes, offered: fitsInADay({ dailyMinutes, minutes }) },
    lessonsLeft: items.length,
  };
}

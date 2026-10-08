import "server-only";
import { type PlanItem, type StudySessionBlock, prisma } from "@zoonk/db";
import { parsePlanChangePayload } from "../../plans/_utils/plan-change-payload";
import { readBlockPayload } from "../block-payload";
import { type PlannedLesson } from "../session-builder";
import { loadPlanLessons } from "./load-plan-lessons";
import { type CatchUpView } from "./session-view";

const LEARN_KINDS: PlanItem["kind"][] = ["lesson", "chapter"];

/**
 * The lessons earlier days left that the learner hasn't done yet: what the plan's last new-day
 * settling carried first (see `refreshGoalPlan`), still to do. Empty when the learner is on pace.
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
    where: { id: { in: carriedItemIds }, kind: { in: LEARN_KINDS }, status: "todo" },
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

/** Where catching up stands on a day (see `CatchUpView`); null when the learner is on pace. */
export async function loadCatchUpView({
  blocks,
  goalId,
  userId,
}: {
  blocks: readonly StudySessionBlock[];
  goalId: string | null;
  userId: string;
}): Promise<CatchUpView | null> {
  const { items, lessons } = await loadLaterCatchUp({ blocks, goalId, userId });

  if (items.length === 0) {
    return null;
  }

  return {
    blockIds: blocks.filter((block) => isCatchingUp({ block, items })).map((block) => block.id),
    later: {
      lessons: lessons.length,
      minutes: Math.round(lessons.reduce((total, lesson) => total + lesson.minutes, 0)),
    },
    lessonsLeft: items.length,
  };
}

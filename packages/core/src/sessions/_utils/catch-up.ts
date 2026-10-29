import { type PlanItem, type StudyFreshStart, prisma } from "@zoonk/db";
import "server-only";
import { parsePlanChangePayload } from "../../plans/_utils/plan-change-payload";
import { LEARN_KINDS } from "../../plans/planner/plan-item-rules";
import { readBlockPayload } from "../block-payload";
import { type PlannedLesson } from "../session-builder";
import { type DayBlockInput } from "./day-block-view";
import { loadPlanLessons } from "./load-plan-lessons";
import { type SessionPlanItem } from "./session-plan-item";
import { type CatchUpView } from "./session-view";

/** Bound optional catch-up to roughly one extra study day so returning learners do not create enormous queues. */
const CATCH_UP_DAY_SHARE = 1.25;

/** Excludes unoutlined stand-ins and resumed-pause work: returning from a pause is not falling behind. */
export async function loadCatchUpItems(goalId: string | null): Promise<PlanItem[]> {
  if (!goalId) {
    return [];
  }

  const settled = await prisma.planChange.findFirst({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    where: { kind: { in: ["missedDays", "resumed"] }, plan: { goalId } },
  });

  if (settled?.kind !== "missedDays") {
    return [];
  }

  const { carriedItemIds } = parsePlanChangePayload(settled.payload);

  if (carriedItemIds.length === 0) {
    return [];
  }

  return prisma.planItem.findMany({
    orderBy: { position: "asc" },
    where: {
      OR: [{ lessonId: { not: null } }, { chapterId: { not: null } }],
      id: { in: carriedItemIds },
      kind: { in: [...LEARN_KINDS] },
      status: "todo",
    },
  });
}

export function isCatchingUp({
  block,
  items,
}: {
  block: DayBlockInput;
  items: readonly SessionPlanItem[];
}): boolean {
  const { planItemId } = readBlockPayload(block);

  return (
    block.kind === "learn" &&
    items.some(
      (item) =>
        (item.id !== null && item.id === planItemId) ||
        (item.lessonId !== null && item.lessonId === block.lessonId),
    )
  );
}

export async function loadLaterCatchUp({
  blocks,
  goalId,
}: {
  blocks: readonly DayBlockInput[];
  goalId: string | null;
}): Promise<{ items: PlanItem[]; lessons: PlannedLesson[] }> {
  const items = await loadCatchUpItems(goalId);

  const inDay = new Set(
    items.filter((item) => blocks.some((block) => isCatchingUp({ block, items: [item] }))),
  );

  const later = items.filter((item) => !inDay.has(item));

  return { items, lessons: later.length > 0 ? await loadPlanLessons({ items: later }) : [] };
}

function fitsInADay({ dailyMinutes, minutes }: { dailyMinutes: number; minutes: number }) {
  return minutes > 0 && minutes <= dailyMinutes * CATCH_UP_DAY_SHARE;
}

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

/** Returns null when the learner is on pace. */
export async function loadCatchUpView({
  blocks,
  dailyMinutes,
  examTomorrow,
  freshStart,
  goalId,
  selectedItems,
  trialEnded,
}: {
  blocks: readonly DayBlockInput[];
  /** Use the goal's daily minutes to size the extra catch-up day. */
  dailyMinutes: number;
  examTomorrow: boolean;
  freshStart: StudyFreshStart | null;
  goalId: string | null;
  selectedItems?: readonly SessionPlanItem[];
  trialEnded: boolean;
}): Promise<CatchUpView | null> {
  if (isQuietDay({ examTomorrow, freshStart, trialEnded })) {
    return null;
  }

  const { items, lessons } = selectedItems
    ? await loadSelectedCatchUp({ blocks, items: selectedItems })
    : await loadLaterCatchUp({ blocks, goalId });

  if (items.length === 0) {
    return null;
  }

  const minutes = Math.round(lessons.reduce((total, lesson) => total + lesson.minutes, 0));

  return {
    blockIds: blocks
      .filter((block) => isCatchingUp({ block, items }))
      .flatMap((block) => block.id ?? []),
    later: { lessons: lessons.length, minutes, offered: fitsInADay({ dailyMinutes, minutes }) },
    lessonsLeft: items.length,
    positions: blocks
      .filter((block) => isCatchingUp({ block, items }))
      .map((block) => block.position),
  };
}

/** Stale previews use selected work before persistence records its missed-day notice. */
async function loadSelectedCatchUp({
  blocks,
  items,
}: {
  blocks: readonly DayBlockInput[];
  items: readonly SessionPlanItem[];
}) {
  const later = items.filter(
    (item) => !blocks.some((block) => isCatchingUp({ block, items: [item] })),
  );

  return { items, lessons: later.length > 0 ? await loadPlanLessons({ items: later }) : [] };
}

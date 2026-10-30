import { type PlanItem, type StudyFreshStart, prisma } from "@zoonk/db";
import "server-only";
import { parsePlanChangePayload } from "../../plans/_utils/plan-change-payload";
import { LEARN_KINDS } from "../../plans/planner/plan-item-rules";
import { DEFAULT_LESSON_MINUTES } from "../../plans/planner/plan-units";
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

function listLater<Item extends SessionPlanItem>({
  blocks,
  items,
}: {
  blocks: readonly DayBlockInput[];
  items: readonly Item[];
}): Item[] {
  return items.filter((item) => !blocks.some((block) => isCatchingUp({ block, items: [item] })));
}

export async function loadLaterCatchUp({
  blocks,
  goalId,
}: {
  blocks: readonly DayBlockInput[];
  goalId: string | null;
}): Promise<{ items: PlanItem[]; lessons: PlannedLesson[] }> {
  const items = await loadCatchUpItems(goalId);
  const later = listLater({ blocks, items });

  return { items, lessons: later.length > 0 ? await loadPlanLessons({ items: later }) : [] };
}

/** A long break leaves thousands of lessons for later: count and size them without loading them. */
async function sizeLessons(
  items: readonly Pick<SessionPlanItem, "lessonId">[],
): Promise<{ lessons: number; minutes: number }> {
  const ids = items.flatMap((item) => item.lessonId ?? []);

  if (ids.length === 0) {
    return { lessons: 0, minutes: 0 };
  }

  const where = { id: { in: ids }, setAsideAt: null };

  const [sized, unsized] = await Promise.all([
    prisma.lesson.aggregate({ _count: { id: true }, _sum: { estimatedMinutes: true }, where }),
    prisma.lesson.count({ where: { ...where, estimatedMinutes: { lte: 0 } } }),
  ]);

  return {
    lessons: sized._count.id,
    minutes: (sized._sum.estimatedMinutes ?? 0) + unsized * DEFAULT_LESSON_MINUTES,
  };
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

  // A stale preview uses the selected work before persistence records its missed-day notice.
  const items: readonly SessionPlanItem[] = selectedItems ?? (await loadCatchUpItems(goalId));

  if (items.length === 0) {
    return null;
  }

  const later = await sizeLessons(listLater({ blocks, items }));
  const minutes = Math.round(later.minutes);

  return {
    blockIds: blocks
      .filter((block) => isCatchingUp({ block, items }))
      .flatMap((block) => block.id ?? []),
    later: { lessons: later.lessons, minutes, offered: fitsInADay({ dailyMinutes, minutes }) },
    lessonsLeft: items.length,
    positions: blocks
      .filter((block) => isCatchingUp({ block, items }))
      .map((block) => block.position),
  };
}

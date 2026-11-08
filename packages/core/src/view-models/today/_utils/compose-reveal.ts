import { type PlanDayView, type PlanItemView } from "../../../plans/plan-view-contract";
import { type DayView } from "../../../sessions/day-view";

export type PlanRevealDays = {
  /** The minutes of what Today lists, from its blocks' estimates. */
  minutes: number;
  /** The six days after today that list something or rest, each lesson listed once. */
  nextDays: PlanDayView[];
  /** The day Today will show. */
  today: DayView;
  /** The first week's study days (today among them when Today lists something) and their time. */
  week: { days: number; minutes: number };
};

type Block = Pick<DayView["blocks"][number], "chapterId" | "estimatedMinutes" | "lessonId">;

type ComposedDays = Omit<PlanRevealDays, "today">;

function listsItem({ blocks, item }: { blocks: readonly Block[]; item: PlanItemView }): boolean {
  if (item.lessonId) {
    return blocks.some((block) => block.lessonId === item.lessonId);
  }

  return Boolean(
    item.chapterId &&
    blocks.some((block) => block.lessonId === null && block.chapterId === item.chapterId),
  );
}

function isTeaching(item: PlanItemView): boolean {
  return item.kind === "lesson" || item.kind === "chapter";
}

/**
 * The reveal's Today and the six days after it, so each lesson shows once. Today lists what its
 * session holds; a lesson the plan laid out today that Today leaves out (reviews took its time)
 * moves to tomorrow; after that, a lesson split across days is listed on its first day only. A day
 * with time but nothing left to list (past the plan's end, or only finishing an earlier lesson)
 * isn't listed.
 */
export function composeRevealDays({
  blocks,
  days,
}: {
  /** What Today lists. */
  blocks: readonly Block[];
  /** Today and the six days after it, as the plan lays them out. */
  days: readonly PlanDayView[];
}): ComposedDays {
  const [planToday, ...ahead] = days;

  const left = (planToday?.items ?? []).filter(
    (item) => isTeaching(item) && item.status === "todo" && !listsItem({ blocks, item }),
  );

  const listed = new Set<string>();

  const nextDays = ahead.map((day, index) => {
    const items = [...(index === 0 ? left : []), ...day.items].filter((item) => {
      if (listsItem({ blocks, item }) || (item.id !== null && listed.has(item.id))) {
        return false;
      }

      if (item.id !== null) {
        listed.add(item.id);
      }

      return true;
    });

    return { ...day, items };
  });

  const listedDays = nextDays.filter((day) => day.items.length > 0 || day.minutes === 0);

  const minutes = blocks.reduce((total, block) => total + block.estimatedMinutes, 0);
  const studyDays = listedDays.filter((day) => day.items.length > 0);
  const todayCounts = blocks.length > 0 && planToday;

  return {
    minutes,
    nextDays: listedDays,
    week: {
      days: studyDays.length + (todayCounts ? 1 : 0),
      minutes:
        studyDays.reduce((total, day) => total + day.minutes, 0) +
        (todayCounts ? planToday.minutes : 0),
    },
  };
}

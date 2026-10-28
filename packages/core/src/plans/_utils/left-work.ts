import "server-only";
import { carriesGiven } from "../planner/carry-over";
import { type ExistingPlanItem } from "../planner/plan-items";
import { type PlanCarrySnapshot, loadPlanCarrySnapshot } from "./carried-lessons";
import { type PlanContext } from "./plan-context";

const LEARN_KINDS = new Set(["chapter", "lesson"]);

type LeftWorkItem = Pick<
  ExistingPlanItem,
  "kind" | "lessonId" | "phase" | "scheduledFor" | "status"
>;

function isPendingStudyItem<Item extends LeftWorkItem>(
  item: Item,
): item is Item & { scheduledFor: Date } {
  return (
    item.status === "todo" &&
    (LEARN_KINDS.has(item.kind) || item.kind === "boss") &&
    item.scheduledFor !== null
  );
}

/** A current-day summary cannot hide actual overdue work already loaded with the owned plan. */
export function hasOverduePlanWork({ items, today }: Pick<PlanContext, "items" | "today">) {
  return items.some((item) => isPendingStudyItem(item) && item.scheduledFor < today);
}

/**
 * The work earlier days left that today doesn't start with yet (see `loadLeftWorkSelection`), in
 * the plan's order: lessons and challenges due before today and still to do, and lessons the last
 * study day gave the learner (`givenLessonIds`) that the plan has after today.
 */
function selectLeftWork<Item extends LeftWorkItem>({
  givenLessonIds,
  items,
  today,
}: {
  givenLessonIds: ReadonlySet<string>;
  items: readonly Item[];
  today: Date;
}): (Item & { scheduledFor: Date })[] {
  const carries = carriesGiven(items);

  return items.filter(
    (item): item is Item & { scheduledFor: Date } =>
      isPendingStudyItem(item) &&
      (item.scheduledFor < today ||
        (item.lessonId !== null &&
          givenLessonIds.has(item.lessonId) &&
          item.scheduledFor > today &&
          carries(item))),
  );
}

/**
 * The lessons the last study day gave the learner that still count as given: none once today
 * settled them (a new day's settling, or a resume, see `loadTodaySettle`).
 */
function listGivenLessonIds(snapshot: PlanCarrySnapshot): Set<string> {
  return new Set(snapshot.settle === null ? snapshot.previous.lessonIds : []);
}

/**
 * The work earlier days left that today doesn't start with yet: lessons due before today, a
 * phase's challenge due before today and still to play (the plan dates it again, so the day it
 * goes on holds it: Today played one beside a funded mock's day the plan didn't count it on), and
 * lessons the last study day gave the learner that the plan has after today. Once today settled
 * them (a new day's settling, or a resume, see `loadTodaySettle`), those that didn't fit today come
 * first tomorrow: they aren't left again. A new day settles it (see `refreshGoalPlan`), and so does
 * a goal back from a pause (see `computeResumedPlan`).
 */
export async function loadLeftWorkSelection(context: PlanContext) {
  const snapshot = await loadPlanCarrySnapshot(context);

  const left = selectLeftWork({
    givenLessonIds: listGivenLessonIds(snapshot),
    items: context.items,
    today: context.today,
  });

  return { left, snapshot };
}

/** Writers that only need the work keep the same boundary. */
export async function loadLeftWork(context: PlanContext): Promise<PlanContext["items"]> {
  const { left } = await loadLeftWorkSelection(context);
  return left;
}

/** Earlier unfinished saved work, in its saved order; screens make no new allocation. */
export function readEarlierWork(
  context: Pick<PlanContext, "items" | "today">,
): PlanContext["items"] {
  return selectLeftWork({ givenLessonIds: new Set(), items: context.items, today: context.today });
}

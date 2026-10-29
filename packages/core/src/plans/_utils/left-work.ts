import "server-only";
import { carriesGiven } from "../planner/carry-over";
import { PHASE_WORK_KINDS } from "../planner/plan-item-rules";
import { type ExistingPlanItem } from "../planner/plan-items";
import { type PlanCarrySnapshot, loadPlanCarrySnapshot } from "./carried-lessons";
import { type PlanContext } from "./plan-context";

type LeftWorkItem = Pick<
  ExistingPlanItem,
  "kind" | "lessonId" | "phase" | "scheduledFor" | "status"
>;

function isPendingStudyItem<Item extends LeftWorkItem>(
  item: Item,
): item is Item & { scheduledFor: Date } {
  return item.status === "todo" && PHASE_WORK_KINDS.has(item.kind) && item.scheduledFor !== null;
}

export function hasOverduePlanWork({ items, today }: Pick<PlanContext, "items" | "today">) {
  return items.some((item) => isPendingStudyItem(item) && item.scheduledFor < today);
}

export function selectLeftWork<Item extends LeftWorkItem>({
  givenLessonIds = new Set<string>(),
  items,
  today,
}: {
  givenLessonIds?: ReadonlySet<string>;
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

function listGivenLessonIds(snapshot: PlanCarrySnapshot): Set<string> {
  return new Set(snapshot.settle === null ? snapshot.previous.lessonIds : []);
}

export async function loadLeftWorkSelection(context: PlanContext) {
  const snapshot = await loadPlanCarrySnapshot(context);

  const left = selectLeftWork({
    givenLessonIds: listGivenLessonIds(snapshot),
    items: context.items,
    today: context.today,
  });

  return { left, snapshot };
}

export async function loadLeftWork(context: PlanContext): Promise<PlanContext["items"]> {
  const { left } = await loadLeftWorkSelection(context);
  return left;
}

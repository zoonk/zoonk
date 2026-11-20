import { type PlanItem } from "@zoonk/db";
import { LEARN_KINDS } from "../../plans/planner/plan-item-rules";

type OrderedItem = Pick<PlanItem, "chapterId" | "kind" | "position" | "skillId" | "status"> & {
  id: string | null;
};

function isOpenLesson(item: OrderedItem): boolean {
  return item.status === "todo" && LEARN_KINDS.has(item.kind);
}

function listSegments<Item extends OrderedItem>(items: readonly Item[]): Item[][] {
  return items.reduce<Item[][]>(
    (segments, item) => {
      if (isOpenLesson(item)) {
        segments.at(-1)?.push(item);
      } else if (item.status === "todo") {
        segments.push([]);
      }

      return segments;
    },
    [[]],
  );
}

function liftLeftWork<Item extends OrderedItem>({
  leftIds,
  lessons,
}: {
  leftIds: ReadonlySet<string>;
  lessons: readonly Item[];
}): Item[] {
  const skillOf = (item: Item) => item.skillId ?? item.chapterId ?? item.id;

  const lastLeft = new Map(
    lessons.flatMap((item, index) =>
      item.id !== null && leftIds.has(item.id) ? [[skillOf(item), index] as const] : [],
    ),
  );

  const isLifted = (item: Item, index: number) => index <= (lastLeft.get(skillOf(item)) ?? -1);

  return [
    ...lessons.filter((item, index) => isLifted(item, index)),
    ...lessons.filter((item, index) => !isLifted(item, index)),
  ];
}

/**
 * Lessons an earlier day left come before today's own, even when today's sit earlier in the plan.
 * Each takes the lessons of its skill before it along, so a skill is still taught in order, and no
 * lesson passes a challenge, review or mock.
 */
export function putLeftWorkFirst<Item extends OrderedItem>({
  items,
  left,
}: {
  items: readonly Item[];
  left: readonly { id: string }[];
}): Item[] {
  const leftIds = new Set(left.map((item) => item.id));
  const sorted = items.toSorted((a, b) => a.position - b.position);

  const positions = new Map(
    listSegments(sorted).flatMap((lessons) =>
      liftLeftWork({ leftIds, lessons }).map((item, index) => [item, lessons[index]?.position]),
    ),
  );

  return sorted
    .map((item) => ({ ...item, position: positions.get(item) ?? item.position }))
    .toSorted((a, b) => a.position - b.position);
}

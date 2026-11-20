import { type PlanItem } from "@zoonk/db";
import { LEARN_KINDS } from "../../plans/planner/plan-item-rules";

type OrderedItem = Pick<PlanItem, "chapterId" | "kind" | "position" | "skillId" | "status"> & {
  id: string | null;
};

type Prerequisites = ReadonlyMap<string, readonly string[]>;

const LEFT = 0;
const NEEDED = 1;
const REST = 2;

function listRequiredSkills({
  prerequisites,
  skillId,
}: {
  prerequisites: Prerequisites;
  skillId: string;
}): Set<string> {
  const required = new Set<string>();
  const pending = [...(prerequisites.get(skillId) ?? [])];

  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if (!required.has(next)) {
      required.add(next);
      pending.push(...(prerequisites.get(next) ?? []));
    }
  }

  return required;
}

/** Phase challenges wait for the lessons before them, so only they fix a lesson's place. */
function listSegments<Item extends OrderedItem>(items: readonly Item[]): Item[][] {
  return items.reduce<Item[][]>(
    (segments, item) => {
      if (item.status === "todo" && LEARN_KINDS.has(item.kind)) {
        segments.at(-1)?.push(item);
      } else if (item.status === "todo" && item.kind === "boss") {
        segments.push([]);
      }

      return segments;
    },
    [[]],
  );
}

function scheduleSegment<Item extends OrderedItem>({
  leftIds,
  lessons,
  prerequisites,
}: {
  leftIds: ReadonlySet<string>;
  lessons: readonly Item[];
  prerequisites: Prerequisites;
}): Item[] {
  const isLeft = (item: Item) => item.id !== null && leftIds.has(item.id);
  const lastLeft = lessons.findLastIndex((item) => isLeft(item));
  const head = lessons.slice(0, lastLeft + 1);

  const required = new Map(
    head.flatMap((item) =>
      item.skillId
        ? [[item.skillId, listRequiredSkills({ prerequisites, skillId: item.skillId })]]
        : [],
    ),
  );

  const comesFirst = (before: Item, after: Item) =>
    (before.skillId !== null &&
      (before.skillId === after.skillId ||
        required.get(after.skillId ?? "")?.has(before.skillId) === true)) ||
    (before.chapterId !== null && before.chapterId === after.chapterId);

  const ranks = head.reduceRight<Map<Item, number>>((map, item, index) => {
    if (isLeft(item)) {
      return map.set(item, LEFT);
    }

    const needed = head
      .slice(index + 1)
      .some((later) => map.get(later) !== REST && comesFirst(item, later));

    return map.set(item, needed ? NEEDED : REST);
  }, new Map());

  const ordered: Item[] = [];
  const waiting = [...head];

  while (waiting.length > 0) {
    const ready = waiting.filter((item, index) =>
      waiting.slice(0, index).every((earlier) => !comesFirst(earlier, item)),
    );

    const next = ready.reduce((best, item) =>
      (ranks.get(item) ?? REST) < (ranks.get(best) ?? REST) ? item : best,
    );

    ordered.push(next);
    waiting.splice(waiting.indexOf(next), 1);
  }

  return [...ordered, ...lessons.slice(lastLeft + 1)];
}

/**
 * Lessons an earlier day left come before today's own, even when today's sit earlier in the plan.
 * A lesson never passes an earlier one of its skill, its chapter or a skill it builds on, nor a
 * phase challenge; a lesson one of them needs comes along first.
 */
export function putLeftWorkFirst<Item extends OrderedItem>({
  items,
  left,
  prerequisites,
}: {
  items: readonly Item[];
  left: readonly { id: string }[];
  prerequisites: Prerequisites;
}): Item[] {
  if (left.length === 0) {
    return [...items];
  }

  const leftIds = new Set(left.map((item) => item.id));
  const sorted = items.toSorted((a, b) => a.position - b.position);

  const positions = new Map(
    listSegments(sorted).flatMap((lessons) =>
      scheduleSegment({ leftIds, lessons, prerequisites }).map((item, index) => [
        item,
        lessons[index]?.position,
      ]),
    ),
  );

  return sorted
    .map((item) => ({ ...item, position: positions.get(item) ?? item.position }))
    .toSorted((a, b) => a.position - b.position);
}

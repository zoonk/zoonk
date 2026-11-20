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
    [...new Set(head.flatMap((item) => item.skillId ?? []))].map((skillId) => [
      skillId,
      listRequiredSkills({ prerequisites, skillId }),
    ]),
  );

  const requiredOf = (item: Item) => required.get(item.skillId ?? "") ?? new Set<string>();
  const ranks = rankLessons({ head, isLeft, requiredOf });
  const { unlocks, waits } = linkWaits({ head, requiredOf });

  const comesBefore = (a: Item, b: Item) =>
    (ranks.get(a) ?? REST) - (ranks.get(b) ?? REST) || a.position - b.position;

  const ready = head.filter((item) => waits.get(item) === 0);
  const ordered: Item[] = [];

  while (ready.length > 0) {
    const next = ready.reduce((best, item) => (comesBefore(item, best) < 0 ? item : best));
    ready.splice(ready.indexOf(next), 1);
    ordered.push(next);

    for (const later of unlocks.get(next) ?? []) {
      const remaining = (waits.get(later) ?? 1) - 1;
      waits.set(later, remaining);

      if (remaining === 0) {
        ready.push(later);
      }
    }
  }

  return [...ordered, ...lessons.slice(lastLeft + 1)];
}

/**
 * What each lesson waits for: the lesson before it in its skill and in its chapter, and the last
 * lesson before it of each skill it builds on. Those lessons wait for the earlier ones in turn.
 */
function linkWaits<Item extends OrderedItem>({
  head,
  requiredOf,
}: {
  head: readonly Item[];
  requiredOf: (item: Item) => ReadonlySet<string>;
}): { unlocks: Map<Item, Item[]>; waits: Map<Item, number> } {
  const lastOfSkill = new Map<string, Item>();
  const lastOfChapter = new Map<string, Item>();
  const unlocks = new Map<Item, Item[]>();
  const waits = new Map<Item, number>();

  for (const item of head) {
    const before = new Set(
      [
        item.skillId === null ? undefined : lastOfSkill.get(item.skillId),
        item.chapterId === null ? undefined : lastOfChapter.get(item.chapterId),
        ...[...requiredOf(item)].map((skillId) => lastOfSkill.get(skillId)),
      ].filter((earlier) => earlier !== undefined),
    );

    waits.set(item, before.size);

    for (const earlier of before) {
      const waiting = unlocks.get(earlier) ?? [];
      waiting.push(item);
      unlocks.set(earlier, waiting);
    }

    if (item.skillId !== null) {
      lastOfSkill.set(item.skillId, item);
    }

    if (item.chapterId !== null) {
      lastOfChapter.set(item.chapterId, item);
    }
  }

  return { unlocks, waits };
}

function toRank({ left, needed }: { left: boolean; needed: boolean }): number {
  if (left) {
    return LEFT;
  }

  return needed ? NEEDED : REST;
}

/** One backward pass: a lesson is needed when a later left or needed lesson must wait for it. */
function rankLessons<Item extends OrderedItem>({
  head,
  isLeft,
  requiredOf,
}: {
  head: readonly Item[];
  isLeft: (item: Item) => boolean;
  requiredOf: (item: Item) => ReadonlySet<string>;
}): Map<Item, number> {
  const skills = new Set<string>();
  const chapters = new Set<string>();
  const ranks = new Map<Item, number>();

  for (const item of head.toReversed()) {
    const needed =
      (item.skillId !== null && skills.has(item.skillId)) ||
      (item.chapterId !== null && chapters.has(item.chapterId));

    const rank = toRank({ left: isLeft(item), needed });
    ranks.set(item, rank);

    if (rank !== REST) {
      if (item.skillId) {
        skills.add(item.skillId);
      }

      if (item.chapterId) {
        chapters.add(item.chapterId);
      }

      for (const skillId of requiredOf(item)) {
        skills.add(skillId);
      }
    }
  }

  return ranks;
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

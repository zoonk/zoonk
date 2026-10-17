import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";

/** Which group each item sits in; items not in the map are still waiting to be sorted. */
export type Placements = Readonly<Record<string, string>>;

type Item = { id: string };

export function unplacedItems<TItem extends Item>(
  items: readonly TItem[],
  placements: Placements,
): TItem[] {
  return items.filter((item) => placements[item.id] === undefined);
}

/** The learner's answer once every item has a group, and nothing while some are left. */
export function placementsAnswer(
  items: readonly Item[],
  placements: Placements,
): Extract<ActivityAnswer, { kind: "assignment" }> | null {
  if (unplacedItems(items, placements).length > 0) {
    return null;
  }

  return {
    kind: "assignment",
    pairs: Object.fromEntries(items.map((item) => [item.id, placements[item.id] ?? ""])),
  };
}

/** Items in the wrong group, compared with the groups code computed from the fields. */
export function misplacedItems<TItem extends Item>({
  expected,
  items,
  placements,
}: {
  expected: Readonly<Record<string, string>>;
  items: readonly TItem[];
  placements: Placements;
}): TItem[] {
  return items.filter((item) => placements[item.id] !== expected[item.id]);
}

/**
 * The next item to sort after one is placed: the one after it in the list, wrapping around, so
 * keyboard focus keeps moving forward through what's left.
 */
export function nextUnplacedId({
  items,
  placedId,
  placements,
}: {
  items: readonly Item[];
  placedId: string;
  placements: Placements;
}): string | null {
  const index = items.findIndex((item) => item.id === placedId);
  const ordered = [...items.slice(index + 1), ...items.slice(0, index + 1)];
  return unplacedItems(ordered, placements)[0]?.id ?? null;
}

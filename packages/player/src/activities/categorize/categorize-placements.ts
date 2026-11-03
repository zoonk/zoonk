import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";

export type Placements = Readonly<Record<string, string>>;

export type SortState = { history: readonly string[]; placements: Placements };

type Item = { id: string };

export function unplacedItems<TItem extends Item>(
  items: readonly TItem[],
  placements: Placements,
): TItem[] {
  return items.filter((item) => placements[item.id] === undefined);
}

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

export function sortCard({
  groupId,
  itemId,
  state,
}: {
  groupId: string;
  itemId: string;
  state: SortState;
}): SortState {
  return {
    history: [...state.history, itemId],
    placements: { ...state.placements, [itemId]: groupId },
  };
}

export function takeBackLastCard(state: SortState): SortState {
  const lastId = state.history.at(-1);

  if (lastId === undefined) {
    return state;
  }

  return {
    history: state.history.slice(0, -1),
    placements: Object.fromEntries(
      Object.entries(state.placements).filter(([itemId]) => itemId !== lastId),
    ),
  };
}

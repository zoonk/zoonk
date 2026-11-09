import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { type ServiceTier } from "@zoonk/ai/provider-options";
import { type GeneratedItem, type OptionSelect } from "@zoonk/ai/tasks/items/schemas";
import { type SolvableItem, solveItems } from "@zoonk/ai/tasks/items/solve";
import { toCheckedItem } from "./create-items";
import { findKeyMismatch } from "./key-mismatch";

declare const keyChecked: unique symbol;

/** Only `checkItemKeys` makes these, so no multiple-choice or true/false key is stored unsolved. */
export type KeyCheckedItem<Item extends GeneratedItem = GeneratedItem> = Item & {
  readonly [keyChecked]: true;
};

/** Formats whose key a blind solve can reproduce; the others reach `createItems` as written. */
export type KeyedFormat = SolvableItem["format"];

type DroppedItem = { index: number; reason: string };

function isSolvable<Item extends GeneratedItem>(item: Item): item is Item & SolvableItem {
  return item.format === "multipleChoice" || item.format === "trueFalse";
}

function markKeyChecked<Item extends GeneratedItem>(item: Item): KeyCheckedItem<Item> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The brand exists only in types, and this is the one place that grants it.
  return item as KeyCheckedItem<Item>;
}

async function solve(params: Parameters<typeof solveItems>[0]) {
  if (params.items.length === 0) {
    return [];
  }

  const { data } = await solveItems(params);
  return data.solutions;
}

/**
 * Takes items as `createItems` will store them. Multiple-choice and true/false items that pass the
 * item checks are solved without their keys in one model call, and each one the solve doesn't
 * reproduce is dropped; items of other formats are kept as written. A provider error throws.
 */
export async function checkItemKeys<Item extends GeneratedItem>({
  analytics,
  items,
  language,
  optionCount = null,
  optionLanguage = null,
  select,
  serviceTier,
  stimulus = null,
}: {
  analytics?: AiGenerationContext;
  items: readonly Item[];
  language: string;
  optionCount?: number | null;
  optionLanguage?: string | null;
  select?: OptionSelect;
  serviceTier?: ServiceTier;
  /** The text every item is about, such as a passage or a law's articles. */
  stimulus?: string | null;
}): Promise<{ dropped: DroppedItem[]; kept: { index: number; item: KeyCheckedItem<Item> }[] }> {
  const solvable = items.flatMap((item, index) =>
    isSolvable(item)
      ? [
          toCheckedItem({
            answerFormat: { select },
            format: item.format,
            index,
            item,
            language,
            optionCount,
            optionLanguage,
          }),
        ]
      : [],
  );

  const passing = solvable.filter(({ problems }) => problems.length === 0);

  const solutions = await solve({
    analytics,
    items: passing.map(({ item }) => item),
    select,
    serviceTier,
    stimulus,
  });

  const reasons = new Map([
    ...solvable.flatMap(({ index, problems }) =>
      problems.length > 0 ? [[index, problems.join(" ")] as const] : [],
    ),
    ...passing.flatMap(({ index, item }, position) => {
      const reason = findKeyMismatch({ item, solution: solutions[position] ?? null });
      return reason ? [[index, reason] as const] : [];
    }),
  ]);

  const repaired = new Map<number, Item>(passing.map(({ index, item }) => [index, item]));

  return {
    dropped: [...reasons]
      .map(([index, reason]) => ({ index, reason }))
      .toSorted((first, second) => first.index - second.index),
    kept: items.flatMap((item, index) =>
      reasons.has(index) ? [] : [{ index, item: markKeyChecked(repaired.get(index) ?? item) }],
    ),
  };
}

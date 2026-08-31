export const ANSWER_ITEM_SEPARATOR = " → ";

export function normalizeAnswerItem(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function getItemCount({ items, value }: { items: string[]; value: string }): number {
  const normalizedValue = normalizeAnswerItem(value);
  return items.filter((item) => normalizeAnswerItem(item) === normalizedValue).length;
}

function isItemMultisetSubset({
  availableItems,
  selectedItems,
}: {
  availableItems: string[];
  selectedItems: string[];
}): boolean {
  const selectedValues = [...new Set(selectedItems.map((item) => normalizeAnswerItem(item)))];

  return selectedValues.every(
    (value) =>
      getItemCount({ items: selectedItems, value }) <=
      getItemCount({ items: availableItems, value }),
  );
}

export function isSameItemMultiset({
  availableItems,
  selectedItems,
}: {
  availableItems: string[];
  selectedItems: string[];
}): boolean {
  return (
    availableItems.length === selectedItems.length &&
    isItemMultisetSubset({ availableItems, selectedItems })
  );
}

export function getAuthoritativeItem({
  availableItems,
  selectedItem,
}: {
  availableItems: string[];
  selectedItem: string;
}): string | null {
  const normalizedSelectedItem = normalizeAnswerItem(selectedItem);

  return (
    availableItems.find((item) => normalizeAnswerItem(item) === normalizedSelectedItem) ?? null
  );
}

export function getAuthoritativeItems({
  availableItems,
  selectedItems,
}: {
  availableItems: string[];
  selectedItems: string[];
}): string[] | null {
  if (!isItemMultisetSubset({ availableItems, selectedItems })) {
    return null;
  }

  return selectedItems.flatMap((selectedItem) => {
    const item = getAuthoritativeItem({ availableItems, selectedItem });
    return item ? [item] : [];
  });
}

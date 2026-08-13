const MAX_LESSON_ITEMS = 20;

/**
 * Returns one contiguous balanced slice. Earlier groups receive the remainder
 * one item at a time, which keeps every group within one item of the others.
 */
function getBalancedLessonGroup<Item>({
  groupIndex,
  items,
  largerGroupCount,
  minimumGroupSize,
}: {
  groupIndex: number;
  items: Item[];
  largerGroupCount: number;
  minimumGroupSize: number;
}): Item[] {
  const start = groupIndex * minimumGroupSize + Math.min(groupIndex, largerGroupCount);
  const groupSize = minimumGroupSize + (groupIndex < largerGroupCount ? 1 : 0);

  return items.slice(start, start + groupSize);
}

/**
 * Divides an oversized generated result into the fewest possible lessons while
 * keeping neighboring items together. Balancing the groups avoids turning a
 * 21-item result into one full lesson followed by a one-item lesson.
 */
export function splitLessonItems<Item>(items: Item[]): Item[][] {
  if (items.length === 0) {
    return [];
  }

  const groupCount = Math.ceil(items.length / MAX_LESSON_ITEMS);
  const minimumGroupSize = Math.floor(items.length / groupCount);
  const largerGroupCount = items.length % groupCount;

  return Array.from({ length: groupCount }, (_, groupIndex) =>
    getBalancedLessonGroup({ groupIndex, items, largerGroupCount, minimumGroupSize }),
  );
}

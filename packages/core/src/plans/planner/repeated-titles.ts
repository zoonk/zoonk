import { normalizeString } from "@zoonk/utils/string";
import { type ExistingPlanItem } from "./plan-items";
import { type QueueUnit } from "./plan-units";

export function getTitleKey(title: string): string {
  return normalizeString(title);
}

export function withoutRepeatedTitles({
  kept,
  units,
}: {
  kept: readonly ExistingPlanItem[];
  units: readonly QueueUnit[];
}): QueueUnit[] {
  const keptTitles = new Set(
    kept.flatMap((item) => (item.lessonId ? [getTitleKey(item.titleSnapshot)] : [])),
  );

  const titles = units.map((unit) => (unit.lessonId ? getTitleKey(unit.title) : null));

  const firstIndex = titles.reduce(
    (first, title, index) => (title === null || first.has(title) ? first : first.set(title, index)),
    new Map<string, number>(),
  );

  return units.filter((_, index) => {
    const title = titles[index];
    return !title || (!keptTitles.has(title) && firstIndex.get(title) === index);
  });
}

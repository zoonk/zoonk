import { normalizeString } from "@zoonk/utils/string";
import { type ExistingPlanItem } from "./plan-items";
import { type QueueUnit } from "./plan-units";

/** Titles that differ only in case, accents or spacing name one topic. */
export function getTitleKey(title: string): string {
  return normalizeString(title);
}

/**
 * Courses and level bands sometimes each write a lesson on the same topic under the same title
 * ("Ohm's law" in a Physics course and in an ENEM course). A plan teaches it once: a lesson the
 * plan keeps (done, or this week's) holds its title, then the first in plan order does.
 */
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

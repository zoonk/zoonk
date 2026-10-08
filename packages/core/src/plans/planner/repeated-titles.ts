import { normalizeString } from "@zoonk/utils/string";
import { type ExistingPlanItem } from "./plan-items";
import { type QueueUnit } from "./plan-units";

/**
 * Courses and level bands sometimes each write a lesson on the same topic under the same title
 * ("Lei de Ohm" in a Physics course and in an ENEM course). A plan teaches it once: a lesson the
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
    kept.flatMap((item) => (item.lessonId ? [normalizeString(item.titleSnapshot)] : [])),
  );

  const titles = units.map((unit) => (unit.lessonId ? normalizeString(unit.title) : null));

  const firstIndex = titles.reduce(
    (first, title, index) => (title === null || first.has(title) ? first : first.set(title, index)),
    new Map<string, number>(),
  );

  return units.filter((_, index) => {
    const title = titles[index];
    return !title || (!keptTitles.has(title) && firstIndex.get(title) === index);
  });
}

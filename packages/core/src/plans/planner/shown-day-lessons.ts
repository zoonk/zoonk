import { readSelectedItemFacts } from "../_utils/selected-item-contract";
import { type BuildPlanInput } from "./build-plan";
import { type PlannerLesson } from "./plan-units";

/**
 * The queue before new lessons landed, including the occupied time of unavailable shown work.
 * Those unavailable entries only reconstruct intervals; the shown-day layout never delivers them.
 */
export function getShownReferenceLessons({
  fresh,
  input,
}: {
  fresh: ReadonlySet<string>;
  input: BuildPlanInput;
}): PlannerLesson[] {
  const lessons = input.lessons.filter((lesson) => !fresh.has(`lesson:${lesson.lessonId}`));
  const available = new Set(lessons.map((lesson) => lesson.lessonId));
  const positions = new Map(input.items.map((item) => [item.lessonId ?? item.id, item.position]));

  const unavailable = input.items.flatMap((item): PlannerLesson[] => {
    if (item.kind !== "lesson" || item.status !== "todo" || available.has(item.lessonId ?? "")) {
      return [];
    }

    const facts = readSelectedItemFacts(item.facts);
    const minutes = facts?.parts.written ?? 0;

    if (!facts || minutes <= 0) {
      return [];
    }

    return [
      {
        chapterId: item.chapterId,
        // If deletion cleared the FK, its real saved item ID identifies this private reservation.
        lessonId: item.lessonId ?? item.id,
        minutes: minutes / input.paceFactor,
        skillIds: item.skillId
          ? [item.skillId, ...facts.skillIds.filter((id) => id !== item.skillId)]
          : facts.skillIds,
        title: item.titleSnapshot,
      },
    ];
  });

  return [...lessons, ...unavailable].toSorted(
    (a, b) => (positions.get(a.lessonId) ?? Infinity) - (positions.get(b.lessonId) ?? Infinity),
  );
}

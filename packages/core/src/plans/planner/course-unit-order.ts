import { type PlannerLesson, type QueueUnit } from "./plan-units";

/** Course position controls sequence; the skill a lesson counts for stays unchanged. */
export function followCourseLessonOrder({
  lessons,
  units,
}: {
  lessons: readonly PlannerLesson[];
  units: QueueUnit[];
}): QueueUnit[] {
  const order = new Map(lessons.map((lesson) => [lesson.lessonId, lesson.courseOrder]));

  if (!units.some((unit) => unit.lessonId && order.get(unit.lessonId))) {
    return units;
  }

  const firstRemainingInPhase = new Map<number, number>();

  const positioned = units.toReversed().map((unit, index) => {
    const placement = unit.lessonId ? order.get(unit.lessonId) : undefined;
    const phase = placement?.phase ?? unit.phase;
    const position = placement?.position ?? firstRemainingInPhase.get(phase) ?? Infinity;

    if (placement) {
      firstRemainingInPhase.set(
        phase,
        Math.min(position, firstRemainingInPhase.get(phase) ?? Infinity),
      );
    }

    return {
      before: !placement,
      index: units.length - index,
      phase,
      position,
      unit: { ...unit, phase },
    };
  });

  /** An added foundation stays before every course lesson that followed it in teaching order. */
  return positioned
    .toSorted(
      (a, b) =>
        a.phase - b.phase ||
        a.position - b.position ||
        Number(b.before) - Number(a.before) ||
        a.index - b.index,
    )
    .map((entry) => entry.unit);
}

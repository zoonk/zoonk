import { type QueueUnit } from "./plan-units";

/**
 * The lesson already being written for the learner to open first stays first while the plan still
 * holds it: only its place moves, so the plan covers the same lessons. It never jumps an earlier
 * phase or its own skill's earlier lessons; the layout still puts what it builds on, the learner's
 * focus, their known areas and placement's gaps ahead of it.
 */
export function putStartLessonFirst({
  lessonId,
  units,
}: {
  lessonId: string | null | undefined;
  units: readonly QueueUnit[];
}): QueueUnit[] {
  const index = units.findIndex((unit) => unit.lessonId !== null && unit.lessonId === lessonId);
  const start = units[index];

  if (!start || index === 0) {
    return [...units];
  }

  const ahead = units.slice(0, index);

  if (ahead.some((unit) => unit.phase < start.phase || unit.skillId === start.skillId)) {
    return [...units];
  }

  return [start, ...ahead, ...units.slice(index + 1)];
}

import { type QueueUnit } from "./plan-units";
import { type DroppedUnit } from "./schedule-units";

/** Lesson minutes the plan covers (done, kept or scheduled) and all of them. */
type CoveredMinutes = { covered: number; total: number };

/**
 * A skill's lesson minutes, and its stand-in's alone (lessons not outlined yet) when it has one:
 * a plan short on time cuts a skill's depth, the stand-in's, before its written lessons.
 */
export type SkillMinutes = CoveredMinutes & { skillId: string; standIn?: CoveredMinutes };

function sumCovered(parts: readonly CoveredMinutes[]): CoveredMinutes {
  return {
    covered: parts.reduce((sum, part) => sum + part.covered, 0),
    total: parts.reduce((sum, part) => sum + part.total, 0),
  };
}

/**
 * Each skill's lesson minutes: the kept ones (done, or this week's) and the pending ones, less
 * what of the dropped ones doesn't fit before the deadline.
 */
export function getSkillMinutes({
  dropped,
  kept,
  pending,
}: {
  dropped: readonly DroppedUnit[];
  kept: readonly QueueUnit[];
  pending: readonly QueueUnit[];
}): SkillMinutes[] {
  const parts = [
    ...[...kept, ...pending].map((unit) => ({ covered: unit.minutes, total: unit.minutes, unit })),
    ...dropped.map((unit) => ({ covered: unit.fittedMinutes - unit.minutes, total: 0, unit })),
  ].flatMap(({ covered, total, unit }) =>
    unit.kind === "lesson" && unit.skillId
      ? [{ covered, skillId: unit.skillId, standIn: unit.lessonId === null, total }]
      : [],
  );

  return [...Map.groupBy(parts, (part) => part.skillId)].map(([skillId, group]) => {
    const standIn = group.filter((part) => part.standIn);

    return {
      ...sumCovered(group),
      skillId,
      ...(standIn.length > 0 && { standIn: sumCovered(standIn) }),
    };
  });
}

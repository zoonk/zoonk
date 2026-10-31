import { type QueueUnit } from "./plan-units";
import { type DroppedUnit } from "./schedule-units";

type CoveredMinutes = { covered: number; total: number };

export type SkillMinutes = CoveredMinutes & { skillId: string; standIn?: CoveredMinutes };

export function hasCompleteSkillCoverage(skills: readonly SkillMinutes[]): boolean {
  return skills.every((skill) => skill.covered >= skill.total);
}

function sumCovered(parts: readonly CoveredMinutes[]): CoveredMinutes {
  return {
    covered: parts.reduce((sum, part) => sum + part.covered, 0),
    total: parts.reduce((sum, part) => sum + part.total, 0),
  };
}

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

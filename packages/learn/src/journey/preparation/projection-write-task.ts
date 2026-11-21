import { type WrittenProjection } from "@zoonk/core/exams/scoring/written-points-contract";

/**
 * What "Write" on the score sheet opens, or null when no written part needs work: the first question
 * not measured yet, so a part with one measured question asks for the other one.
 */
export function getProjectionWriteTask(
  projection: WrittenProjection,
): { taskKey: string | undefined } | null {
  const needsWriting = projection.parts.some((part) => !part.range || part.standing === "below");

  if (!needsWriting) {
    return null;
  }

  const unmeasured = projection.parts
    .flatMap(({ tasks }) => tasks)
    .find(({ range }) => range === null);

  return { taskKey: unmeasured?.key };
}

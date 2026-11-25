import { type StudyBlockView, type StudySessionView } from "./_utils/session-view";

type AlternativeBlock = Pick<
  StudyBlockView,
  "kind" | "position" | "preparing" | "status" | "waitReason" | "writingAvailability"
>;

/** The first available non-lesson block while a lesson is being written. */
function findAvailableAlternative<Block extends AlternativeBlock>({
  blocks,
  position,
}: {
  blocks: readonly Block[];
  position: number;
}): Block | null {
  return (
    blocks.find(
      (block) =>
        block.position !== position &&
        block.status === "pending" &&
        block.kind !== "learn" &&
        block.waitReason === null &&
        !block.preparing &&
        block.writingAvailability?.status !== "tomorrow",
    ) ?? null
  );
}

export function getAlternativeStudyBlockPosition({
  blocks,
  nextPosition,
}: {
  blocks: readonly AlternativeBlock[];
  nextPosition: number | null;
}): number | null {
  return nextPosition === null
    ? null
    : (findAvailableAlternative({ blocks, position: nextPosition })?.position ?? null);
}

/** For an explicitly opened step, use the same rule with that step as the exclusion. */
export function findAlternativeStudyBlock({
  day,
  position,
}: {
  day: Pick<StudySessionView, "alternativePosition" | "blocks" | "nextPosition">;
  position: number;
}): StudyBlockView | null {
  return position === day.nextPosition
    ? (day.blocks.find((block) => block.position === day.alternativePosition) ?? null)
    : findAvailableAlternative({ blocks: day.blocks, position });
}

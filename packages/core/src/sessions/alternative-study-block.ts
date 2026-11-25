import { type StudyBlockView } from "./_utils/session-view";

type AlternativeBlock = Pick<
  StudyBlockView,
  "kind" | "position" | "preparing" | "status" | "waitReason" | "writingAvailability"
>;

/**
 * What a learner can do while a lesson is being written: the day's first available step that isn't
 * a lesson. Only a lesson waits, so the same step serves whichever lesson the learner opened.
 */
export function getAlternativeStudyBlockPosition(
  blocks: readonly AlternativeBlock[],
): number | null {
  return (
    blocks.find(
      (block) =>
        block.status === "pending" &&
        block.kind !== "learn" &&
        block.waitReason === null &&
        !block.preparing &&
        block.writingAvailability?.status !== "tomorrow",
    )?.position ?? null
  );
}

export function findAlternativeStudyBlock<Block extends { position: number }>(day: {
  alternativePosition: number | null;
  blocks: readonly Block[];
}): Block | null {
  return day.blocks.find((block) => block.position === day.alternativePosition) ?? null;
}

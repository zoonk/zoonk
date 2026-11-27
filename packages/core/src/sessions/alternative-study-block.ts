import { type StudyBlockView } from "./_utils/session-view";

type AlternativeBlock = Pick<
  StudyBlockView,
  "kind" | "position" | "preparing" | "status" | "waitReason" | "writingAvailability"
>;

/** Only a lesson waits, so one step serves whichever lesson the learner is waiting on. */
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

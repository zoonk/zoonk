import { type StudyBlockView } from "./_utils/session-view";

/** Excludes waiting blocks so learners can continue while a lesson is being written. */
export function findAlternativeStudyBlock<
  Block extends Pick<StudyBlockView, "id" | "kind" | "status" | "waitReason">,
>({ blockId, blocks }: { blockId: string; blocks: readonly Block[] }): Block | null {
  return (
    blocks.find(
      (block) =>
        block.id !== blockId &&
        block.status === "pending" &&
        block.kind !== "learn" &&
        block.waitReason === null,
    ) ?? null
  );
}

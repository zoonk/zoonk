import { type StudyBlockStatus } from "@zoonk/db";

function isFinished(block: { status: StudyBlockStatus }): boolean {
  return block.status === "completed" || block.status === "skipped";
}

/**
 * Every client draws the day's list and its bar in this order, so both say the same: what's finished
 * first, then the rest, each in the day's order. A block finished ahead of an earlier one (the review
 * offered while a mock is being prepared) joins the finished ones.
 */
export function inDayOrder<Block extends { position: number; status: StudyBlockStatus }>(
  blocks: readonly Block[],
): Block[] {
  const ordered = blocks.toSorted((a, b) => a.position - b.position);

  return [
    ...ordered.filter((block) => isFinished(block)),
    ...ordered.filter((block) => !isFinished(block)),
  ];
}

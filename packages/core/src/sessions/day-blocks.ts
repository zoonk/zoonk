type QueueBlock = {
  extra?: boolean;
  payload?: unknown;
  position: number;
  preparing?: boolean;
  status: string;
  writingAvailability?: { status: string };
};

/** Accepts saved rows, which keep `extra` in their payload, and block views, which carry it. */
export function isDayBlock(block: { extra?: boolean; payload?: unknown }): boolean {
  return !(
    block.extra === true ||
    (block.payload &&
      typeof block.payload === "object" &&
      "extra" in block.payload &&
      block.payload.extra === true)
  );
}

export function getPlayOrder<Block extends QueueBlock>(blocks: readonly Block[]): Block[] {
  return blocks
    .filter((block) => block.status === "active" || block.status === "pending")
    .toSorted(
      (a, b) =>
        Number(b.status === "active") - Number(a.status === "active") ||
        Number(isDayBlock(b)) - Number(isDayBlock(a)) ||
        a.position - b.position,
    );
}

/**
 * A block that can't start now keeps its place in the order but is never played next: a mock whose
 * questions aren't written yet, or writing whose grading returns tomorrow.
 */
export function getNextBlock<Block extends QueueBlock>(
  blocks: readonly Block[],
): Block | undefined {
  return getPlayOrder(blocks).find(
    (block) =>
      !block.preparing &&
      (block.status === "active" || block.writingAvailability?.status !== "tomorrow"),
  );
}

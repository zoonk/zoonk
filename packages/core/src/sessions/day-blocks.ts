type QueueBlock = {
  extra?: boolean;
  payload?: unknown;
  position: number;
  preparing?: boolean;
  status: string;
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

/** A mock whose questions aren't written yet keeps its place in the order but is never played next. */
export function getNextBlock<Block extends QueueBlock>(
  blocks: readonly Block[],
): Block | undefined {
  return getPlayOrder(blocks).find((block) => !block.preparing);
}

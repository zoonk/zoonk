type QueueBlock = { extra?: boolean; payload?: unknown; position: number; status: string };

export function isDayBlock(block: { extra?: boolean; payload?: unknown }): boolean {
  return (
    !block.extra &&
    !(
      block.payload &&
      typeof block.payload === "object" &&
      "extra" in block.payload &&
      block.payload.extra === true
    )
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

export function getSessionBlockOrder<Block extends QueueBlock>(blocks: readonly Block[]): Block[] {
  return [
    ...blocks.filter((block) => block.status !== "active" && block.status !== "pending"),
    ...getPlayOrder(blocks),
  ];
}

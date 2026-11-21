import { AnyNull } from "@zoonk/db";

type QueueBlock = { payload?: unknown; position: number; status: string };

export function isDayBlock(block: { payload?: unknown }): boolean {
  return !(
    block.payload &&
    typeof block.payload === "object" &&
    "extra" in block.payload &&
    block.payload.extra === true
  );
}

export const DAY_BLOCK_WHERE = {
  OR: [
    { payload: { equals: AnyNull, path: ["extra"] } },
    { NOT: { payload: { equals: true, path: ["extra"] } } },
  ],
};

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

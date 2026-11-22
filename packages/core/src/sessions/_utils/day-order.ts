import { type StudyBlockStatus } from "@zoonk/db";
import { getPlayOrder } from "../day-blocks";

/**
 * Every client draws the day's list and its bar in this order, so both say the same: what's finished
 * first, then the rest in play order. A block finished ahead of an earlier one (the review offered
 * while a mock is being prepared) joins the finished ones.
 */
export function inDayOrder<
  Block extends { extra?: boolean; payload?: unknown; position: number; status: StudyBlockStatus },
>(blocks: readonly Block[]): Block[] {
  return [
    ...blocks
      .filter((block) => block.status === "completed" || block.status === "skipped")
      .toSorted((a, b) => a.position - b.position),
    ...getPlayOrder(blocks),
  ];
}

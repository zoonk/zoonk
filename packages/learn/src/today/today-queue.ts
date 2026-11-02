import { type DayStep } from "../session/session-types";

export function isFinished(block: Pick<DayStep, "status">): boolean {
  return block.status === "completed" || block.status === "skipped";
}

export function splitTodayQueue<Block extends Pick<DayStep, "position" | "status">>({
  blocks,
  nextPosition,
}: {
  blocks: readonly Block[];
  nextPosition: number;
}) {
  const nextIndex = blocks.findIndex((block) => block.position === nextPosition);

  return {
    after: blocks.slice(nextIndex + 1).filter((block) => !isFinished(block)),
    before: blocks.slice(0, nextIndex).filter((block) => !isFinished(block)),
    done: blocks.filter((block) => isFinished(block)),
  };
}

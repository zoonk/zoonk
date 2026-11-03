import { type DayStep } from "../session/session-types";

export function isFinished(block: Pick<DayStep, "status">): boolean {
  return block.status === "completed" || block.status === "skipped";
}

/**
 * Only a finished lesson opens again: a skipped one comes back in the plan, and a review's,
 * practice's or challenge's content was made for that day.
 */
export function getLessonAgainId(block: Pick<DayStep, "kind" | "lessonId" | "status">) {
  return block.status === "completed" && block.kind === "learn" ? block.lessonId : null;
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

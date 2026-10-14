import { type StudyBlock } from "../session/session-types";

/** Whether a block is behind the learner: completed or skipped. */
export function isFinished(block: Pick<StudyBlock, "status">): boolean {
  return block.status === "completed" || block.status === "skipped";
}

/** Finished work folds together; unfinished work keeps its order around the active block. */
export function splitTodayQueue<Block extends Pick<StudyBlock, "id" | "status">>({
  blocks,
  nextId,
}: {
  blocks: readonly Block[];
  nextId: string;
}) {
  const nextIndex = blocks.findIndex((block) => block.id === nextId);

  return {
    after: blocks.slice(nextIndex + 1).filter((block) => !isFinished(block)),
    before: blocks.slice(0, nextIndex).filter((block) => !isFinished(block)),
    done: blocks.filter((block) => isFinished(block)),
  };
}

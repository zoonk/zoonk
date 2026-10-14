import { type StudyBlock } from "./session-types";

/** Where a block of the day stands in its queue: done, the one Continue opens, or still ahead. */
type SessionQueueState = "ahead" | "done" | "next";

export type SessionQueueRow = { block: StudyBlock; state: SessionQueueState };

/**
 * The day's queue as Today draws it: every block still in the day in order (skipped ones leave
 * it), the ones finished done, the one Continue opens next, and the minutes the rest still take.
 * `finishedId` is a block that just ended on this screen: the session's copy may still have it
 * running.
 */
export function getSessionQueue({
  blocks,
  finishedId = null,
  nextId,
}: {
  blocks: readonly StudyBlock[];
  finishedId?: string | null;
  nextId: string | null;
}): { minutesLeft: number; rows: SessionQueueRow[] } {
  const rows = blocks
    .filter((block) => block.status !== "skipped")
    .map((block): SessionQueueRow => {
      if (block.status === "completed" || block.id === finishedId) {
        return { block, state: "done" };
      }

      return { block, state: block.id === nextId ? "next" : "ahead" };
    });

  const minutesLeft = rows
    .filter((row) => row.state !== "done")
    .reduce((total, row) => total + row.block.estimatedMinutes, 0);

  return { minutesLeft, rows };
}

import { type DayStep } from "./session-types";

/** Where a block of the day stands in its queue: done, the one Continue opens, or still ahead. */
type SessionQueueState = "ahead" | "done" | "next";

export type SessionQueueRow = { block: DayStep; state: SessionQueueState };

function hasId(block: DayStep, id: string | null): boolean {
  return id !== null && "id" in block && block.id === id;
}

/**
 * The day's queue as Today draws it: every block still in the day in order (skipped ones leave
 * it), the ones finished done, the one Continue opens next, and the minutes the rest still take.
 * The next one is named by its id on a saved day, or by its place in the day (`nextPosition`),
 * which a day not opened yet has too. `finishedId` is a block that just ended on this screen: the
 * session's copy may still have it running.
 */
export function getSessionQueue({
  blocks,
  finishedId = null,
  nextId = null,
  nextPosition = null,
}: {
  blocks: readonly DayStep[];
  finishedId?: string | null;
  nextId?: string | null;
  nextPosition?: number | null;
}): { minutesLeft: number; rows: SessionQueueRow[] } {
  const isNext = (block: DayStep) =>
    nextPosition === null ? hasId(block, nextId) : block.position === nextPosition;

  const rows = blocks
    .filter((block) => block.status !== "skipped")
    .map((block): SessionQueueRow => {
      if (block.status === "completed" || hasId(block, finishedId)) {
        return { block, state: "done" };
      }

      return { block, state: isNext(block) ? "next" : "ahead" };
    });

  const minutesLeft = rows
    .filter((row) => row.state !== "done")
    .reduce((total, row) => total + row.block.estimatedMinutes, 0);

  return { minutesLeft, rows };
}

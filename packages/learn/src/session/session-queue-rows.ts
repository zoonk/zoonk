import { type DayStep } from "./session-types";

type SessionQueueState = "ahead" | "done" | "next";

export type SessionQueueRow = { block: DayStep; state: SessionQueueState };

function hasId(block: DayStep, id: string | null): boolean {
  return id !== null && "id" in block && block.id === id;
}

/**
 * `finishedId` is a block that just ended on this screen, which the session's copy may still have
 * running.
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

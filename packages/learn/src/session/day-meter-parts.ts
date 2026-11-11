import { type DayMeterPart, type DaySegmentState } from "../today/day-segments";
import { getBlockKind } from "./block-kind";
import { type SessionQueueRow } from "./session-queue-rows";

const SEGMENT_BY_STATE: Record<SessionQueueRow["state"], DaySegmentState> = {
  ahead: "ahead",
  done: "done",
  next: "current",
};

/**
 * One part per row of `getSessionQueue`, which leaves skipped blocks out, so the parts match core's
 * `sessionBar` count. `nextShare` (0 to 1) fills the next part as far as it's answered.
 */
export function getDayMeterParts({
  nextShare = 0,
  rows,
}: {
  nextShare?: number;
  rows: readonly SessionQueueRow[];
}): DayMeterPart[] {
  return rows.map((row) => ({
    id: "id" in row.block ? row.block.id : row.block.position,
    kind: getBlockKind(row.block),
    share: row.state === "next" ? nextShare : 0,
    state: SEGMENT_BY_STATE[row.state],
  }));
}

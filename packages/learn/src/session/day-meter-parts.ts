import { type LearnKind } from "../_components/kind-tile";
import { type DayMeterPart, type DaySegmentState } from "../today/day-segments";
import { getBlockKind } from "./block-kind";
import { type SessionQueueRow } from "./session-queue-rows";
import { type DayStep } from "./session-types";

const SEGMENT_BY_STATE: Record<SessionQueueRow["state"], DaySegmentState> = {
  ahead: "ahead",
  done: "done",
  next: "current",
};

export type DayStepPart = DayMeterPart & { block: DayStep; kind: LearnKind };

/**
 * One part per row of `getSessionQueue`, which leaves skipped blocks out, so the parts match core's
 * `sessionBar` count. `nextShare` (0 to 1) fills the next part as far as it's answered. Today and
 * every block's end draw these parts.
 */
export function getDayMeterParts({
  nextShare = 0,
  rows,
}: {
  nextShare?: number;
  rows: readonly SessionQueueRow[];
}): DayStepPart[] {
  return rows.map((row) => ({
    block: row.block,
    id: "id" in row.block ? row.block.id : row.block.position,
    kind: getBlockKind(row.block),
    share: row.state === "next" ? nextShare : 0,
    state: SEGMENT_BY_STATE[row.state],
  }));
}

import { type BossTiming } from "../../checkpoints/_utils/boss-reached";
import { type PlanPhaseCheckpointView } from "../plan-view-contract";
import { toIsoDate } from "../planner/plan-calendar";
import { type ExistingPlanItem } from "../planner/plan-items";
import { isWorkFinished } from "./work-progress";

/** The checkpoint that closes the phase, the Trickster's, when it has one. */
export function buildCheckpoint({
  locked = false,
  items,
  timings,
}: {
  locked?: boolean;
  items: readonly ExistingPlanItem[];
  /** When each challenge still to win comes (`getBossTimings`); empty where sessions hold none. */
  timings: ReadonlyMap<string, BossTiming>;
}): PlanPhaseCheckpointView | null {
  const boss = items.find((item) => item.kind === "boss");

  if (!boss) {
    return null;
  }

  return {
    date: boss.scheduledFor ? toIsoDate(boss.scheduledFor) : null,
    locked: locked && boss.status === "todo",
    planItemId: boss.id,
    state: isWorkFinished(boss.status) ? "done" : "upcoming",
    when: timings.get(boss.id) ?? "date",
  };
}

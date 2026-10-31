import { type BossTiming } from "../../checkpoints/_utils/boss-reached";
import { type PlanPhaseCheckpointView } from "../plan-view-contract";
import { toIsoDate } from "../planner/plan-calendar";
import { type PlanReadItem, getPlanReadItemKey } from "./plan-read-projection";
import { isWorkFinished } from "./work-progress";

export function buildCheckpoint({
  locked = false,
  items,
  timings,
}: {
  locked?: boolean;
  items: readonly PlanReadItem[];
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
    when:
      (boss.id ? timings.get(boss.id) : undefined) ??
      timings.get(getPlanReadItemKey(boss)) ??
      "date",
  };
}

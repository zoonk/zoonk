import { type ChallengeTiming } from "../../checkpoints/_utils/challenge-timing";
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
  timings: ReadonlyMap<string, ChallengeTiming>;
}): PlanPhaseCheckpointView | null {
  const boss = items.find((item) => item.kind === "boss");

  if (!boss) {
    return null;
  }

  const timing = timings.get(boss.id ?? "") ?? timings.get(getPlanReadItemKey(boss));

  return {
    date: timing?.date ?? (boss.scheduledFor ? toIsoDate(boss.scheduledFor) : null),
    locked: locked && boss.status === "todo",
    planItemId: boss.id,
    state: isWorkFinished(boss.status) ? "done" : "upcoming",
    when: locked || boss.status !== "todo" ? "date" : (timing?.when ?? "date"),
  };
}

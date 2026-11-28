import { type ChallengeTiming } from "../../checkpoints/_utils/challenge-timing";
import { type PlanPhaseCheckpointView, type PlanPhaseView } from "../plan-view-contract";
import { toIsoDate } from "../planner/plan-calendar";
import { type PlanPhase } from "../planner/plan-state";
import { getPhaseMilestoneDates } from "./course-finish";
import { type PlanReadItem, getPlanReadItemKey } from "./plan-read-projection";
import { isWorkFinished } from "./work-progress";

function buildCheckpoint({
  locked = false,
  items,
  precision,
  timings,
}: {
  locked?: boolean;
  items: readonly PlanReadItem[];
  precision: PlanPhaseCheckpointView["precision"];
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
    ...(precision && boss.status === "todo" && { precision }),
    state: isWorkFinished(boss.status) ? "done" : "upcoming",
    when: locked || boss.status !== "todo" ? "date" : (timing?.when ?? "date"),
  };
}

export function buildPhaseMilestones({
  items,
  locked,
  phase,
  timings,
  today,
}: {
  items: readonly PlanReadItem[];
  locked: boolean;
  phase: PlanPhase;
  timings: ReadonlyMap<string, ChallengeTiming>;
  today: Date | null;
}): Pick<
  PlanPhaseView,
  "challengeLeftOut" | "checkpoint" | "endDate" | "milestone" | "precision" | "startDate"
> {
  const dates = getPhaseMilestoneDates({ phase, today });
  const later = phase.later === true;
  const checkpoint = buildCheckpoint({ items, locked, precision: dates.precision, timings });

  return {
    challengeLeftOut: !later && phase.challengeLeftOut === true,
    checkpoint:
      later && checkpoint?.state !== "done"
        ? {
            date: null,
            later: true,
            locked,
            planItemId: checkpoint?.planItemId ?? null,
            precision: null,
            state: "upcoming",
            when: "date",
          }
        : checkpoint,
    ...dates,
    milestone:
      phase.milestone
        ?.trimEnd()
        .replace(/[.。]$/u, "")
        .trimEnd() || null,
  };
}

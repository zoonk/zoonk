import { type ChallengeTiming } from "../../checkpoints/_utils/challenge-timing";
import { type PlanPhaseCheckpointView, type PlanPhaseView } from "../plan-view-contract";
import { toIsoDate } from "../planner/plan-calendar";
import { type PlanPhase } from "../planner/plan-state";
import { getPhaseMilestoneDates } from "./course-finish";
import { type PlanReadItem, getPlanReadItemKey } from "./plan-read-projection";
import { isWorkFinished } from "./work-progress";

function buildCheckpoint({
  boss,
  locked = false,
  precision,
  timing,
}: {
  boss: PlanReadItem | undefined;
  locked?: boolean;
  precision: PlanPhaseCheckpointView["precision"];
  timing?: ChallengeTiming;
}): PlanPhaseCheckpointView | null {
  if (!boss) {
    return null;
  }

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
  const boss = items.find((item) => item.kind === "boss");
  const timing = boss && (timings.get(boss.id ?? "") ?? timings.get(getPlanReadItemKey(boss)));
  const checkpoint = buildCheckpoint({ boss, locked, precision: dates.precision, timing });

  return {
    challengeLeftOut: !later && phase.challengeLeftOut === true,
    checkpoint:
      (timing?.later ?? later) && checkpoint?.state !== "done"
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

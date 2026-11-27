import { isDeepStrictEqual } from "node:util";
import { toIsoDate } from "../planner/plan-calendar";
import { LEARN_KINDS } from "../planner/plan-item-rules";
import { type ComputedPlan } from "./replan";

type GuardedPlan = {
  built: Pick<
    ComputedPlan["built"],
    "droppedSkillIds" | "items" | "phases" | "skillMinutes" | "waitingSkillIds"
  >;
  feasibility: Pick<
    ComputedPlan["feasibility"],
    "coreFits" | "coveredShare" | "fits" | "timeCovers"
  >;
  selected: Pick<ComputedPlan["selected"], "coverage" | "endDate" | "forecast">;
};

function scheduleFacts(plan: GuardedPlan, movableFrom: Date) {
  const { built, feasibility, selected } = plan;
  const deadline = selected.coverage?.deadline;

  const items = built.items.map(({ chapterId, id, key, kind, phase, scheduledFor, status }) => {
    const day = scheduledFor && toIsoDate(scheduledFor);

    const movable =
      LEARN_KINDS.has(kind) && status === "todo" && scheduledFor && scheduledFor >= movableFrom;

    return {
      chapterId,
      id,
      key,
      status,
      ...(movable ? { beforeDeadline: deadline && day && day <= deadline } : { day, phase }),
    };
  });

  return {
    coreFits: feasibility.coreFits,
    coverageBySkill: selected.coverage?.skills,
    coveredShare: feasibility.coveredShare,
    dropped: built.droppedSkillIds.toSorted(),
    endDate: selected.endDate,
    fits: feasibility.fits,
    forecast: selected.forecast,
    items: items.toSorted((a, b) => a.key.localeCompare(b.key)),
    phases: built.phases.map(({ endDate, startDate }) => [startDate, endDate]),
    skillMinutes: built.skillMinutes.toSorted((a, b) => a.skillId.localeCompare(b.skillId)),
    waiting: built.waitingSkillIds.toSorted(),
  };
}

/** A mock can move future lessons while holding the plan's work, coverage and pace. */
export function holdsSchedule({
  baseline,
  computed,
  movableFrom,
}: {
  baseline: GuardedPlan;
  computed: GuardedPlan;
  movableFrom: Date;
}): boolean {
  return (
    isDeepStrictEqual(scheduleFacts(baseline, movableFrom), scheduleFacts(computed, movableFrom)) &&
    baseline.feasibility.timeCovers === computed.feasibility.timeCovers
  );
}

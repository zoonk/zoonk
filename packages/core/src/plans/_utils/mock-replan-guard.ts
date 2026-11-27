import { isDeepStrictEqual } from "node:util";
import { toIsoDate } from "../planner/plan-calendar";
import { LEARN_KINDS } from "../planner/plan-item-rules";
import { PLAN_EPSILON } from "../planner/plan-precision";
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
  selected: Pick<ComputedPlan["selected"], "coverage" | "endDate">;
};

function scheduleFacts(plan: GuardedPlan, movableFrom: Date) {
  const { built, feasibility, selected } = plan;
  const deadline = selected.coverage?.deadline;

  const items = built.items.flatMap(({ chapterId, id, key, kind, phase, scheduledFor, status }) => {
    if (kind === "review") {
      return [];
    }

    const day = scheduledFor && toIsoDate(scheduledFor);

    const movable =
      LEARN_KINDS.has(kind) && status === "todo" && scheduledFor && scheduledFor >= movableFrom;

    return [
      {
        chapterId,
        id,
        key,
        status,
        ...(movable ? { beforeDeadline: deadline && day && day <= deadline } : { day, phase }),
      },
    ];
  });

  return {
    coreFits: feasibility.coreFits,
    coverageBySkill: selected.coverage?.skills,
    coveredShare: feasibility.coveredShare,
    dropped: built.droppedSkillIds.toSorted(),
    fits: feasibility.fits,
    items: items.toSorted((a, b) => a.key.localeCompare(b.key)),
    phases: built.phases.map(({ endDate, startDate }) => [startDate, endDate]),
    skillMinutes: built.skillMinutes.toSorted((a, b) => a.skillId.localeCompare(b.skillId)),
    waiting: built.waitingSkillIds.toSorted(),
  };
}

/** Minutes cut at day boundaries sum back with float noise that depends on where the cuts fall. */
function isSameFact(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) <= PLAN_EPSILON;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => isSameFact(value, b[index]));
  }

  if (isRecord(a) && isRecord(b)) {
    const keys = Object.keys(a);

    return (
      isDeepStrictEqual(keys, Object.keys(b)) && keys.every((key) => isSameFact(a[key], b[key]))
    );
  }

  return isDeepStrictEqual(a, b);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype
  );
}

function listReviewKeys(plan: GuardedPlan): Set<string> {
  return new Set(plan.built.items.flatMap(({ key, kind }) => (kind === "review" ? [key] : [])));
}

/**
 * Lessons packed in a new order can end a day sooner, which frees that day for a review before the
 * exam; ending later, or losing a review day, is what a learner would see as worse.
 */
function endsNoLater({ baseline, computed }: { baseline: GuardedPlan; computed: GuardedPlan }) {
  const before = baseline.selected.endDate;
  const after = computed.selected.endDate;

  return (
    (before === after || (before !== null && after !== null && after <= before)) &&
    listReviewKeys(baseline).isSubsetOf(listReviewKeys(computed))
  );
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
    isSameFact(scheduleFacts(baseline, movableFrom), scheduleFacts(computed, movableFrom)) &&
    endsNoLater({ baseline, computed }) &&
    baseline.feasibility.timeCovers === computed.feasibility.timeCovers
  );
}

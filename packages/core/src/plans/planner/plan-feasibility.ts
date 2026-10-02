import { type BuildPlanInput, type BuiltPlan, buildPlan } from "./build-plan";
import { fromIsoDate, scaleWeekdayMinutes } from "./plan-calendar";
import { getExamWindows } from "./plan-phases";
import { getSkillArea, isExamSchedule } from "./plan-queue";
import { MAX_DAILY_MINUTES } from "./plan-state";

/**
 * What fits in the time the learner has and what more time would change. With a deadline: the
 * share of the goal's weight covered before it, and the daily minutes that would cover everything
 * (null when it fits, or when even the maximum wouldn't). Without one: when the plan ends, and
 * when it would end with more time a day.
 */
export type PlanFeasibility = {
  alternative: { dailyMinutes: number; endDate: Date | null } | null;
  coveredShare: number;
  /** The last day for new lessons: the exam's final stretch, or the target date. */
  deadline: Date | null;
  fits: boolean;
  recommendedMinutes: number | null;
};

const MINUTES_STEP = 5;

/** "At 1 hour a day": the next step up when there's no deadline. */
const ALTERNATIVE_MINUTES = 60;
const ALTERNATIVE_STEP = 30;

function withDailyMinutes(input: BuildPlanInput, dailyMinutes: number): BuildPlanInput {
  return {
    ...input,
    goal: { ...input.goal, dailyMinutes },
    settings: {
      ...input.settings,
      weekdayMinutes: scaleWeekdayMinutes({
        dailyMinutes,
        from: input.goal.dailyMinutes,
        weekdayMinutes: input.settings.weekdayMinutes,
      }),
    },
  };
}

function getDeadline(input: BuildPlanInput): Date | null {
  const { targetDate } = input.goal;

  if (!targetDate || !isExamSchedule(input.goal)) {
    return targetDate;
  }

  const planStart = input.settings.startDate ? fromIsoDate(input.settings.startDate) : input.today;
  const windows = getExamWindows({ planStart, targetDate });

  return windows.find((window) => window.kind === "finalStretch")?.startDate ?? targetDate;
}

function getCoveredShare({ built, input }: { built: BuiltPlan; input: BuildPlanInput }): number {
  const skipped = new Set(input.settings.skippedAreas);
  const dropped = new Set(built.droppedSkillIds);

  const skills = input.graph.skills.filter(
    (skill) => !skipped.has(getSkillArea({ graph: input.graph, skill })),
  );

  const weightOf = (list: typeof skills) =>
    list.reduce((total, skill) => total + (skill.weight ?? 1), 0);

  const total = weightOf(skills);

  return total === 0
    ? 1
    : 1 - weightOf(skills.filter((skill) => dropped.has(skill.skillId))) / total;
}

/** The fewest daily minutes, in steps of 5, at which nothing is left out. */
function findRecommendedMinutes(input: BuildPlanInput): number | null {
  const first = Math.ceil((input.goal.dailyMinutes + 1) / MINUTES_STEP) * MINUTES_STEP;
  const steps = Math.floor((MAX_DAILY_MINUTES - first) / MINUTES_STEP) + 1;
  const candidates = Array.from({ length: Math.max(0, steps) }, (_, i) => first + i * MINUTES_STEP);

  const fits = (minutes: number) =>
    buildPlan(withDailyMinutes(input, minutes)).droppedSkillIds.length === 0;

  const search = (low: number, high: number): number | null => {
    if (low > high) {
      return null;
    }

    const middle = Math.floor((low + high) / 2);
    const minutes = candidates[middle] ?? MAX_DAILY_MINUTES;

    if (!fits(minutes)) {
      return search(middle + 1, high);
    }

    return search(low, middle - 1) ?? minutes;
  };

  return search(0, candidates.length - 1);
}

function getAlternative({ built, input }: { built: BuiltPlan; input: BuildPlanInput }) {
  const current = input.goal.dailyMinutes;

  const next = Math.min(
    MAX_DAILY_MINUTES,
    current < ALTERNATIVE_MINUTES ? ALTERNATIVE_MINUTES : current + ALTERNATIVE_STEP,
  );

  if (next <= current || built.estimate.endDate === null) {
    return null;
  }

  return { dailyMinutes: next, endDate: buildPlan(withDailyMinutes(input, next)).estimate.endDate };
}

export function getPlanFeasibility({
  built,
  input,
}: {
  built: BuiltPlan;
  input: BuildPlanInput;
}): PlanFeasibility {
  const deadline = getDeadline(input);
  const fits = built.droppedSkillIds.length === 0;

  return {
    alternative: deadline ? null : getAlternative({ built, input }),
    coveredShare: getCoveredShare({ built, input }),
    deadline,
    fits,
    recommendedMinutes: fits ? null : findRecommendedMinutes(input),
  };
}

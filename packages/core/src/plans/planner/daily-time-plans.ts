import { type BuildPlanInput, type BuiltPlan, buildPlan } from "./build-plan";
import { scaleWeekdayMinutes } from "./plan-calendar";
import { MAX_DAILY_MINUTES } from "./plan-state";

const MINUTES_STEP = 5;

/**
 * The plan at another daily time, as switching to it plans it: from today, this week included,
 * so what another time covers doesn't depend on the time this week was planned at, and with its
 * phase dates re-planned, as a learner's change does.
 */
export function withDailyMinutes(input: BuildPlanInput, dailyMinutes: number): BuildPlanInput {
  return {
    ...input,
    goal: { ...input.goal, dailyMinutes },
    mode: "forced",
    phaseEnds: undefined,
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

/**
 * The plan at each daily time as switching to it plans it (see `withDailyMinutes`), each built
 * once: the time search often tries the most time a day, which says what that covers too.
 */
export function planAtMinutes(input: BuildPlanInput): (dailyMinutes: number) => BuiltPlan {
  const plans = new Map<number, BuiltPlan>();

  return (dailyMinutes) => {
    const plan = plans.get(dailyMinutes) ?? buildPlan(withDailyMinutes(input, dailyMinutes));
    plans.set(dailyMinutes, plan);
    return plan;
  };
}

/**
 * The fewest daily minutes, in steps of 5, at which the plan `fits`: nothing left out
 * (`isWhole`), or every topic in (`hasEveryTopic`). The search starts above the learner's time
 * (`above`), or from the least time a day when what's asked is the time the goal needs whatever
 * the learner gives now.
 */
export function findFittingMinutes({
  above,
  fits: fitsPlan,
  planAt,
}: {
  above: number;
  fits: (built: BuiltPlan) => boolean;
  /** The plan at a daily time (see `planAtMinutes`). */
  planAt: (dailyMinutes: number) => BuiltPlan;
}): number | null {
  const first = Math.ceil((above + 1) / MINUTES_STEP) * MINUTES_STEP;
  const steps = Math.floor((MAX_DAILY_MINUTES - first) / MINUTES_STEP) + 1;
  const candidates = Array.from({ length: Math.max(0, steps) }, (_, i) => first + i * MINUTES_STEP);
  const fits = (minutes: number) => fitsPlan(planAt(minutes));

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

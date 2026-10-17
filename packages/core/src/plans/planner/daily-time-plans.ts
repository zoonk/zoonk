import { type BuildPlanInput, type BuiltPlan, buildPlan } from "./build-plan";
import { scaleWeekdayMinutes } from "./plan-calendar";
import { MAX_DAILY_MINUTES } from "./plan-state";

const MINUTES_STEP = 5;

/** A candidate's complete accepted schedule, including its normalized daily time. */
export type StudyScheduleAt = (
  dailyMinutes: number,
) => Pick<BuildPlanInput["goal"], "dailyMinutes"> &
  Pick<BuildPlanInput["settings"], "weekdayMinutes">;

/**
 * The plan at another daily time, as switching to it plans it: from today, this week included,
 * so what another time covers doesn't depend on the time this week was planned at, and with its
 * phase dates re-planned, as a learner's change does.
 */
export function withDailyMinutes(
  input: BuildPlanInput,
  dailyMinutes: number,
  studyScheduleAt?: StudyScheduleAt,
): BuildPlanInput {
  const schedule = studyScheduleAt?.(dailyMinutes) ?? {
    dailyMinutes,
    weekdayMinutes: scaleWeekdayMinutes({
      dailyMinutes,
      from: input.goal.dailyMinutes,
      weekdayMinutes: input.settings.weekdayMinutes,
    }),
  };

  return {
    ...input,
    goal: { ...input.goal, dailyMinutes: schedule.dailyMinutes },
    mode: "forced",
    phaseEnds: undefined,
    settings: { ...input.settings, weekdayMinutes: schedule.weekdayMinutes },
  };
}

/**
 * The plan at each daily time as switching to it plans it (see `withDailyMinutes`), each built
 * once: the time search often tries the most time a day, which says what that covers too.
 */
export function planAtMinutes(
  input: BuildPlanInput,
  studyScheduleAt?: StudyScheduleAt,
): (dailyMinutes: number) => BuiltPlan {
  const plans = new Map<string, BuiltPlan>();

  return (dailyMinutes) => {
    const candidate = withDailyMinutes(input, dailyMinutes, studyScheduleAt);
    /** Distinct inputs can normalize to one saved schedule, especially weekend-only weeks. */
    const key = studyScheduleAt
      ? `${candidate.goal.dailyMinutes}:${candidate.settings.weekdayMinutes?.join(",") ?? "daily"}`
      : String(dailyMinutes);

    const plan = plans.get(key) ?? buildPlan(candidate);

    plans.set(key, plan);
    return plan;
  };
}

/**
 * The fewest daily minutes, in steps of 5, at which the plan `fits`: nothing left out
 * (`isWhole`), or every topic in (`hasEveryTopic`), and anything else asked of that time
 * (`holds`). The search starts above the learner's time (`above`), or from the least time a day
 * when what's asked is the time the goal needs whatever the learner gives now. Every time is
 * tried in order: more time can hold less (a weekly mock that comes with it takes a study day).
 */
export function findFittingMinutes({
  above,
  fits: fitsPlan,
  holds,
  mayFit,
  planAt,
}: {
  above: number;
  fits: (built: BuiltPlan) => boolean;
  /** What else that time must do, tried only once the plan fits, since each try plans again. */
  holds?: (dailyMinutes: number) => boolean;
  /** An optional necessary bound; true still requires evaluating the actual plan. */
  mayFit?: (dailyMinutes: number) => boolean;
  /** The plan at a daily time (see `planAtMinutes`). */
  planAt: (dailyMinutes: number) => BuiltPlan;
}): number | null {
  const first = Math.ceil((above + 1) / MINUTES_STEP) * MINUTES_STEP;
  const steps = Math.floor((MAX_DAILY_MINUTES - first) / MINUTES_STEP) + 1;
  const candidates = Array.from({ length: Math.max(0, steps) }, (_, i) => first + i * MINUTES_STEP);

  /** More time can add a mock that takes a lesson day, even when every daily budget increases. */
  return (
    candidates.find(
      (minutes) =>
        (mayFit?.(minutes) ?? true) && fitsPlan(planAt(minutes)) && (holds?.(minutes) ?? true),
    ) ?? null
  );
}

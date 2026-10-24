import { MAX_DAILY_MINUTES } from "../daily-minutes";
import { type BuildPlanInput, type BuiltPlan, buildPlan } from "./build-plan";
import { scaleWeekdayMinutes } from "./plan-calendar";

const MINUTES_STEP = 5;

/**
 * Up to 4 hours a day the search tries every time (see `findFittingMinutes`). Trying every time
 * up to a whole day would plan a real-size exam about 290 times, half a minute a learner waits.
 */
const EVERY_TIME_UP_TO = 240;

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
 * once: the search for the time that covers everything and the one that brings every topic in
 * try the same times.
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
 * Halves the way between a time that doesn't fit (`short`) and one that does (`fitting`), on the
 * 5-minute steps, down to the fitting time right after the short one.
 */
function narrowFit({
  fits,
  fitting,
  short,
}: {
  fits: (dailyMinutes: number) => boolean;
  fitting: number;
  short: number;
}): number {
  if (fitting - short <= MINUTES_STEP) {
    return fitting;
  }

  const middle = short + Math.floor((fitting - short) / (2 * MINUTES_STEP)) * MINUTES_STEP;

  return fits(middle)
    ? narrowFit({ fits, fitting: middle, short })
    : narrowFit({ fits, fitting, short: middle });
}

/**
 * The fewest daily minutes, in steps of 5, at which the plan at that time (see `planAtMinutes`)
 * `fits`: it covers everything, or holds every topic, whatever the learner gives now. Up to 4 hours
 * every time is tried in order: more time can hold less (a weekly mock that comes with it takes a
 * study day). Past that, when a whole day fits, the search halves its way down to a time that fits
 * (see `narrowFit`): always one that does, though for the same reason it can be a little more than
 * the fewest (the Sunday exam in `recommended-time.test.ts`, scaled up, holds every topic at 285
 * minutes, not at 345, and again at 400). Null when not even a whole day fits.
 */
export function findFittingMinutes(fits: (dailyMinutes: number) => boolean): number | null {
  const times = Array.from(
    { length: EVERY_TIME_UP_TO / MINUTES_STEP },
    (_, index) => (index + 1) * MINUTES_STEP,
  );

  /** More time can add a mock that takes a lesson day, even when every daily budget increases. */
  const found = times.find((minutes) => fits(minutes));

  if (found !== undefined) {
    return found;
  }

  return fits(MAX_DAILY_MINUTES)
    ? narrowFit({ fits, fitting: MAX_DAILY_MINUTES, short: EVERY_TIME_UP_TO })
    : null;
}

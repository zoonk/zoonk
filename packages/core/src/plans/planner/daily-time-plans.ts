import { MAX_DAILY_MINUTES } from "../daily-minutes";
import { type BuildPlanInput, type BuiltPlan, buildPlan } from "./build-plan";
import { scaleWeekdayMinutes } from "./plan-calendar";

const MINUTES_STEP = 5;

/**
 * Past this, trying every time would plan a real-size exam about 290 times: half a minute of
 * waiting.
 */
const EVERY_TIME_UP_TO = 240;

export type StudyScheduleAt = (
  dailyMinutes: number,
) => Pick<BuildPlanInput["goal"], "dailyMinutes"> &
  Pick<BuildPlanInput["settings"], "weekdayMinutes">;

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

export function planAtMinutes(
  input: BuildPlanInput,
  studyScheduleAt?: StudyScheduleAt,
): (dailyMinutes: number) => BuiltPlan {
  const plans = new Map<string, BuiltPlan>();

  return (dailyMinutes) => {
    const candidate = withDailyMinutes(input, dailyMinutes, studyScheduleAt);

    const key = studyScheduleAt
      ? `${candidate.goal.dailyMinutes}:${candidate.settings.weekdayMinutes?.join(",") ?? "daily"}`
      : String(dailyMinutes);

    const plan = plans.get(key) ?? buildPlan(candidate);

    plans.set(key, plan);
    return plan;
  };
}

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
 * Tries every time up to `EVERY_TIME_UP_TO` in order, since more time can hold less (a weekly mock
 * that comes with it takes a study day); past that it halves toward a time that fits. Null when not
 * even a whole day fits. No time under `floor` can fit, so none is tried: the answer stays the one
 * trying them all would find.
 */
export function findFittingMinutes(
  fits: (dailyMinutes: number) => boolean,
  floor = 0,
): number | null {
  const fitsFromFloor = (minutes: number) => minutes >= floor && fits(minutes);

  const times = Array.from(
    { length: EVERY_TIME_UP_TO / MINUTES_STEP },
    (_, index) => (index + 1) * MINUTES_STEP,
  );

  const found = times.find((minutes) => fitsFromFloor(minutes));

  if (found !== undefined) {
    return found;
  }

  return fitsFromFloor(MAX_DAILY_MINUTES)
    ? narrowFit({ fits: fitsFromFloor, fitting: MAX_DAILY_MINUTES, short: EVERY_TIME_UP_TO })
    : null;
}

import { type PlanTimeAdvice, type PlanTimeToCover } from "@zoonk/core/plans/time-advice-contract";

export const PAST_DATE = { pastDate: true, recommendedMinutes: null, suggested: null };

export const TOO_CLOSE = { recommendedMinutes: null, suggested: null };

const DEFAULT_ADVICE_COVERED_SHARE = 0.48;
const DEFAULT_ADVICE_REACHED_SHARE = 0.6;

export function foundTime(time: Partial<PlanTimeToCover> = {}): PlanTimeToCover {
  return {
    fittingDate: null,
    most: null,
    pastDate: false,
    readingNotice: false,
    ready: true,
    recommendedMinutes: 35,
    suggested: {
      coveredShare: 1,
      everyTopic: true,
      kind: "everything",
      minutes: 35,
      reachedShare: 1,
      split: null,
    },
    targetDate: "2028-10-29",
    targetDateNamedMonth: false,
    ...time,
  };
}

export function everythingAt(minutes: number): Partial<PlanTimeToCover> {
  return {
    recommendedMinutes: minutes,
    suggested: {
      coveredShare: 1,
      everyTopic: true,
      kind: "everything",
      minutes,
      reachedShare: 1,
      split: null,
    },
  };
}

export function focusAt(recommendedMinutes: number | null): Partial<PlanTimeToCover> {
  return {
    recommendedMinutes,
    suggested: {
      coveredShare: 0.32,
      everyTopic: false,
      kind: "focus",
      minutes: 240,
      reachedShare: 0.6,
      split: null,
    },
  };
}

export function adviceAt(advice: Partial<PlanTimeAdvice> = {}): PlanTimeAdvice {
  return {
    coveredShare: DEFAULT_ADVICE_COVERED_SHARE,
    endDate: null,
    focusSubjects: [],
    fullCourseEndDate: null,
    measure: "goal",
    numbers: null,
    reachedShare:
      advice.coveredShare === null
        ? null
        : Math.max(DEFAULT_ADVICE_REACHED_SHARE, advice.coveredShare ?? 0),
    readingNotice: false,
    ready: true,
    targetDate: "2028-10-29",
    targetDateNamedMonth: false,
    ...advice,
  };
}

export const LINE = {
  advice: null,
  askFailed: false,
  dated: true,
  findFailed: false,
  found: foundTime(),
  hasDays: true,
  minutes: 35,
};

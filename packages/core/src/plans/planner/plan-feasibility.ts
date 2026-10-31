import { once } from "@zoonk/utils/once";
import { roundShare } from "../_utils/plan-feasibility-view";
import { type SelectedCoverage } from "../_utils/selected-summary-contract";
import { MAX_DAILY_MINUTES, MIN_DAILY_MINUTES } from "../daily-minutes";
import { type BuildPlanInput, type BuiltPlan, buildPlan } from "./build-plan";
import {
  type StudyScheduleAt,
  findFittingMinutes,
  narrowFit,
  planAtMinutes,
  withDailyMinutes,
} from "./daily-time-plans";
import { deepensMostAsked, hasEveryTopic } from "./feasibility-topics";
import { findFittingDate } from "./fitting-date";
import { getFittingFloor } from "./fitting-floor";
import { fromIsoDate } from "./plan-calendar";
import { type ExamSubjectShare, getSkillValue } from "./selected-coverage";
import { getSelectedCoverage } from "./selected-plan-summary";

export type TimeCoverage = { coreFits: boolean; coveredShare: number };

export type MostCoverage = { coveredShare: number; minutes: number };

export type PlanFeasibility = {
  alternative: { dailyMinutes: number; endDate: Date | null } | null;
  coreFits: boolean;
  coverageAt: (dailyMinutes: number) => TimeCoverage;
  coveredShare: number;
  deepensMostAsked: boolean;
  deadline: Date | null;
  endDate: Date | null;
  fits: boolean;
  fittingDate: Date | null;
  fullCourseEndDate: Date | null;
  measure: "exam" | "goal";
  /**
   * When part of the goal never fits, whatever the time (a whole day covers no more than half a day
   * does): the fewest minutes that cover as much as a whole day.
   */
  most: MostCoverage | null;
  recommendedMinutes: number | null;
  skillFits: ReadonlyMap<string, number>;
  /**
   * Never read off `recommendedMinutes`: more time a day can cover less (a weekly mock takes a
   * study day).
   */
  timeCovers: boolean;
};

const ALTERNATIVE_MINUTES = 60;
const ALTERNATIVE_STEP = 30;

function studyingEverything(input: BuildPlanInput): BuildPlanInput {
  return input.goal.kind === "exam"
    ? { ...input, settings: { ...input.settings, fullCourse: true } }
    : { ...input, goal: { ...input.goal, targetDate: null } };
}

function toSkillFits(coverage: SelectedCoverage | null): Map<string, number> {
  return new Map(
    (coverage?.skills ?? []).map((skill) => [skill.skillId, getSkillValue(skill)] as const),
  );
}

export function fitsInDepth(input: BuildPlanInput): boolean {
  const built = buildPlan(withDailyMinutes(input, input.goal.dailyMinutes));
  return getSelectedCoverage({ built, examSubjects: null, input })?.fits ?? true;
}

function getFullCourseEnd(input: BuildPlanInput): Date | null {
  return buildPlan(studyingEverything(input)).estimate.endDate;
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
  examSubjects = null,
  input,
  planned = buildPlan(input),
  plannedInput,
  studyScheduleAt,
}: {
  examSubjects?: readonly ExamSubjectShare[] | null;
  input: BuildPlanInput;
  planned?: BuiltPlan;
  /** What `planned` was built from: a time tried with that same input reuses it. */
  plannedInput?: BuildPlanInput;
  studyScheduleAt?: StudyScheduleAt;
}): PlanFeasibility {
  const known = input.knownSkillIds ?? new Set<string>();
  const coverage = getSelectedCoverage({ built: planned, examSubjects, input });
  const deadline = coverage ? fromIsoDate(coverage.deadline) : null;

  const coreFits =
    coverage?.coreFits ?? hasEveryTopic({ built: planned, known, skills: input.graph.skills });

  const fits = coverage?.fits ?? coreFits;
  const coveredShare = coverage?.coveredShare ?? 1;
  const skillFits = toSkillFits(coverage);
  const fullCourseEndDate = once(() => (deadline && !fits ? getFullCourseEnd(input) : null));

  const plannedAt = once(() =>
    planAtMinutes(input, studyScheduleAt, plannedInput && { built: planned, input: plannedInput }),
  );

  const selectedAt = (dailyMinutes: number) =>
    getSelectedCoverage({ built: plannedAt()(dailyMinutes), examSubjects, input });

  const coverageAt = (dailyMinutes: number): TimeCoverage => {
    const selected = selectedAt(dailyMinutes);

    return {
      coreFits:
        selected?.coreFits ??
        hasEveryTopic({ built: plannedAt()(dailyMinutes), known, skills: input.graph.skills }),
      coveredShare: selected?.coveredShare ?? 1,
    };
  };

  const timeCovers = once(
    () => deadline !== null && (fits || (selectedAt(input.goal.dailyMinutes)?.fits ?? false)),
  );

  const fittingFloor = once(() =>
    getFittingFloor({
      built: plannedAt()(MIN_DAILY_MINUTES),
      examSubjects,
      input,
      studyScheduleAt,
    }),
  );

  const recommendedMinutes = once(() =>
    deadline
      ? findFittingMinutes((minutes) => selectedAt(minutes)?.fits ?? false, fittingFloor())
      : null,
  );

  const shownAt = (minutes: number) => roundShare(coverageAt(minutes).coveredShare);

  const most = once((): MostCoverage | null => {
    if (!deadline || recommendedMinutes() !== null) {
      return null;
    }

    const wholeDay = shownAt(MAX_DAILY_MINUTES);

    if (shownAt(MAX_DAILY_MINUTES / 2) < wholeDay) {
      return null;
    }

    return {
      coveredShare: wholeDay,
      minutes: narrowFit({
        fits: (minutes) => shownAt(minutes) >= wholeDay,
        fitting: MAX_DAILY_MINUTES,
        short: 0,
      }),
    };
  });

  const alternative = once(() => (deadline ? null : getAlternative({ built: planned, input })));

  const fittingDate = once(() =>
    input.goal.kind !== "exam" && deadline && !fits && recommendedMinutes() === null
      ? findFittingDate({
          end: fullCourseEndDate(),
          fitsBy: (targetDate) => fitsInDepth({ ...input, goal: { ...input.goal, targetDate } }),
        })
      : null,
  );

  // Lazy: each builds a plan per time it tries, and most readers never ask.
  return {
    get alternative() {
      return alternative();
    },
    coreFits,
    coverageAt,
    coveredShare,
    deadline,
    deepensMostAsked: deepensMostAsked({ input, known, skillFits }),
    endDate: planned.estimate.endDate,
    fits,
    get fittingDate() {
      return fittingDate();
    },
    get fullCourseEndDate() {
      return fullCourseEndDate();
    },
    measure: coverage?.measure ?? "goal",
    get most() {
      return most();
    },
    get recommendedMinutes() {
      return recommendedMinutes();
    },
    skillFits,
    get timeCovers() {
      return timeCovers();
    },
  };
}

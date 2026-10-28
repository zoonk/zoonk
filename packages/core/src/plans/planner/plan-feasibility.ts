import { once } from "@zoonk/utils/once";
import { type SelectedCoverage } from "../_utils/selected-summary-contract";
import { MAX_DAILY_MINUTES } from "../daily-minutes";
import { type BuildPlanInput, type BuiltPlan, buildPlan } from "./build-plan";
import {
  type StudyScheduleAt,
  findFittingMinutes,
  planAtMinutes,
  withDailyMinutes,
} from "./daily-time-plans";
import { deepensMostAsked, hasEveryTopic } from "./feasibility-topics";
import { findFittingDate } from "./fitting-date";
import { fromIsoDate } from "./plan-calendar";
import { type ExamSubjectShare, getSkillValue } from "./selected-coverage";
import { getSelectedCoverage } from "./selected-plan-summary";

export type PlanFeasibility = {
  alternative: { dailyMinutes: number; endDate: Date | null } | null;
  coreFits: boolean;
  coreMinutes: number | null;
  coveredShare: number;
  deepensMostAsked: boolean;
  deadline: Date | null;
  endDate: Date | null;
  fits: boolean;
  fittingDate: Date | null;
  fullCourseEndDate: Date | null;
  measure: "exam" | "goal";
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
  studyScheduleAt,
}: {
  examSubjects?: readonly ExamSubjectShare[] | null;
  input: BuildPlanInput;
  planned?: BuiltPlan;
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

  const plannedAt = once(() => planAtMinutes(input, studyScheduleAt));

  const coverageAt = (dailyMinutes: number) =>
    getSelectedCoverage({ built: plannedAt()(dailyMinutes), examSubjects, input });

  const timeCovers = once(
    () => deadline !== null && (fits || (coverageAt(input.goal.dailyMinutes)?.fits ?? false)),
  );

  const recommendedMinutes = once(() =>
    deadline ? findFittingMinutes((minutes) => coverageAt(minutes)?.fits ?? false) : null,
  );

  const alternative = once(() => (deadline ? null : getAlternative({ built: planned, input })));

  const fittingDate = once(() =>
    input.goal.kind !== "exam" && deadline && !fits && recommendedMinutes() === null
      ? findFittingDate({
          end: fullCourseEndDate(),
          fitsBy: (targetDate) => fitsInDepth({ ...input, goal: { ...input.goal, targetDate } }),
        })
      : null,
  );

  const coreMinutes = once(() =>
    coreFits
      ? null
      : findFittingMinutes(
          (minutes) =>
            coverageAt(minutes)?.coreFits ??
            hasEveryTopic({ built: plannedAt()(minutes), known, skills: input.graph.skills }),
        ),
  );

  // Lazy: each builds a plan per time it tries, and most readers never ask.
  return {
    get alternative() {
      return alternative();
    },
    coreFits,
    get coreMinutes() {
      return coreMinutes();
    },
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
    get recommendedMinutes() {
      return recommendedMinutes();
    },
    skillFits,
    get timeCovers() {
      return timeCovers();
    },
  };
}

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

/**
 * What fits in the time the learner has and what more time would change, on the one measure the
 * plan saves (see `getSelectedCoverage`): what the plan the learner studies covers of the chosen
 * requirement by its deadline, so the Plan, its suggestions and what a change previews all say the
 * same. With a deadline: whether every topic is in the plan, and the time that brings them all in
 * when one isn't; the share of the whole goal in depth it covers (of the exam, or of the goal; see
 * `measure`), and the daily minutes that cover everything in depth (null when no daily time
 * does). Without one: when the plan ends, and when it would end with more time a day.
 */
export type PlanFeasibility = {
  alternative: { dailyMinutes: number; endDate: Date | null } | null;
  /**
   * Every topic is in the plan by its deadline (`hasEveryTopic`, as `getSelectedCoverage` counts
   * it): each skill it teaches has lesson time before it, with its core first (see
   * `putCoresFirst`), or its topics are taught by another skill that has. The learner studies every
   * topic, the ones worth more in more depth. False when a topic waits for lack of time, which its
   * subject page says too.
   */
  coreFits: boolean;
  /** When a topic waits: the fewest daily minutes that bring every one in, if any do. */
  coreMinutes: number | null;
  coveredShare: number;
  /**
   * The topics the exam asks most keep more of their depth than the others (see
   * `deepensMostAsked`): only then may the plan say it studies them in more depth. Topics the
   * learner showed they know don't count, since practice keeps them, not lessons.
   */
  deepensMostAsked: boolean;
  /**
   * The day what the plan covers is counted up to (see `getSelectedCoverage`): an exam's final
   * stretch as the plan lays it out, or the target date. Null without a date.
   */
  deadline: Date | null;
  /** When the plan ends at the learner's time and pace: the one end date a plan without a date shows. */
  endDate: Date | null;
  fits: boolean;
  /**
   * When no daily time covers a goal that isn't an exam by its date: the earliest date the
   * learner's own time covers everything in depth by, the date to move to. Null otherwise: an
   * exam's date doesn't move (it can go on after the exam instead, see `fullCourseEndDate`).
   */
  fittingDate: Date | null;
  /**
   * When the plan leaves something out by its date: the day the learner finishes everything at
   * their time when they study it all (an exam's going on after the exam, see
   * `PlanSettings.fullCourse`; any other goal's without a date). Null when it all fits.
   */
  fullCourseEndDate: Date | null;
  /**
   * What `coveredShare` is a share of: the exam's questions and points (the notice's subjects, each
   * shared among its skills by their exam weight), or the goal's skills by their weight.
   */
  measure: "exam" | "goal";
  /**
   * The daily time the goal needs: the fewest minutes that cover everything in depth by the
   * deadline (see `findFittingMinutes`), whether or not the learner's time does, on the plan a
   * switch to that time plans. Null without a deadline, or when no daily time does.
   */
  recommendedMinutes: number | null;
  /**
   * How much of each measured skill fits before the deadline, from 0 to 1 (1 for a skill the
   * learner settled): what `coveredShare` adds up.
   */
  skillFits: ReadonlyMap<string, number>;
  /**
   * The learner's own daily time covers everything by the deadline once the plan is planned again
   * at it, as `fits` measures it. True whenever `fits` is, and while it isn't when the plan as it
   * stands holds less than their time fits (a date they moved closer, then faster study). Never
   * read off `recommendedMinutes`: more time a day can cover less (a weekly mock takes a study day),
   * so a lower time that fits says nothing of theirs. False without a deadline.
   */
  timeCovers: boolean;
};

/** "At 1 hour a day": the next step up when there's no deadline. */
const ALTERNATIVE_MINUTES = 60;
const ALTERNATIVE_STEP = 30;

/** The plan studying everything: an exam's going on after the exam, any other goal's without a date. */
function studyingEverything(input: BuildPlanInput): BuildPlanInput {
  return input.goal.kind === "exam"
    ? { ...input, settings: { ...input.settings, fullCourse: true } }
    : { ...input, goal: { ...input.goal, targetDate: null } };
}

/** How much of each measured skill fits by the deadline (see `PlanFeasibility.skillFits`). */
function toSkillFits(coverage: SelectedCoverage | null): Map<string, number> {
  return new Map(
    (coverage?.skills ?? []).map((skill) => [skill.skillId, getSkillValue(skill)] as const),
  );
}

/**
 * Whether the learner's time covers everything in depth by the plan's date, as switching to it
 * plans it (see `withDailyMinutes`), on the plan's one measure (see `getSelectedCoverage`). A plan
 * without a date leaves nothing out.
 */
export function fitsInDepth(input: BuildPlanInput): boolean {
  const built = buildPlan(withDailyMinutes(input, input.goal.dailyMinutes));
  return getSelectedCoverage({ built, examSubjects: null, input })?.fits ?? true;
}

/** When the learner finishes everything at their time, studying it all (see `studyingEverything`). */
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

/**
 * What the learner's time covers and what more time would change, read from the plan they study
 * (`planned`, built from `input`) on the plan's one measure (see `getSelectedCoverage`); other daily
 * times and dates are planned as a switch to them plans them.
 */
export function getPlanFeasibility({
  examSubjects = null,
  input,
  planned = buildPlan(input),
  studyScheduleAt,
}: {
  /** The notice's subjects with their share of the exam; null for goals that aren't exams. */
  examSubjects?: readonly ExamSubjectShare[] | null;
  input: BuildPlanInput;
  /** The plan `input` builds, when the caller already built it. */
  planned?: BuiltPlan;
  /** Evaluate advice candidates through the exact accepted schedule from the original state. */
  studyScheduleAt?: StudyScheduleAt;
}): PlanFeasibility {
  // What the learner showed they know, as the syllabus says it: answered right only in practice,
  // a class test's nucleus counted as in while the syllabus showed it out for time.
  const known = input.knownSkillIds ?? new Set<string>();
  const coverage = getSelectedCoverage({ built: planned, examSubjects, input });
  const deadline = coverage ? fromIsoDate(coverage.deadline) : null;

  const coreFits =
    coverage?.coreFits ?? hasEveryTopic({ built: planned, known, skills: input.graph.skills });

  const fits = coverage?.fits ?? coreFits;
  const coveredShare = coverage?.coveredShare ?? 1;
  const skillFits = toSkillFits(coverage);
  const fullCourseEndDate = once(() => (deadline && !fits ? getFullCourseEnd(input) : null));

  // The plan as a switch to another daily time plans it, built once per time asked about.
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

  // What more or other time would do builds a plan per time it tries: only read when asked, since
  // a change's effect and Progress never ask (a real-size exam's plan builds in tens of ms).
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

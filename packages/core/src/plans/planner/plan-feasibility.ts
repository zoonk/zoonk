import { once } from "@zoonk/utils/once";
import { type BuildPlanInput, type BuiltPlan, buildPlan } from "./build-plan";
import { mayFitInDepthAtMinutes } from "./daily-time-capacity";
import {
  type StudyScheduleAt,
  findFittingMinutes,
  planAtMinutes,
  withDailyMinutes,
} from "./daily-time-plans";
import { type ExamSubjectShare, getCoverage } from "./feasibility-coverage";
import { deepensMostAsked, hasEveryTopic } from "./feasibility-topics";
import { findFittingDate } from "./fitting-date";
import { fromIsoDate } from "./plan-calendar";
import { getExamWindows } from "./plan-phases";
import { isExamSchedule } from "./plan-queue";
import { MAX_DAILY_MINUTES } from "./plan-state";
import { type SizedPlanInput, toSizedPlanInput } from "./sized-plan";

/**
 * What fits in the time the learner has and what more time would change. Whether every topic is in
 * reads the plan the learner studies, lesson by lesson, as the subject pages do, so the two never
 * disagree; how much of the goal in depth it covers reads the plan as its graph sizes it (see
 * `toSizedPlanInput`), so outlining lessons never moves that share. With a deadline: whether every
 * topic is in the plan, and the time that brings them all in when one isn't; the share of the
 * whole goal in depth it covers (of the exam, or of the goal; see `measure`), and the daily
 * minutes that cover everything in depth (null when even the maximum wouldn't, which then says
 * what the maximum covers, when that's more). Without one: when the plan ends, and when it would
 * end with more time a day.
 */
export type PlanFeasibility = {
  alternative: { dailyMinutes: number; endDate: Date | null } | null;
  /**
   * Every topic is in the plan (`hasEveryTopic`): each skill it teaches has lessons in it, with its
   * core first (see `putCoresFirst`), or its topics are taught by another skill that has. The
   * learner studies every topic, the ones worth more in more depth. False when a topic waits for
   * lack of time, which its subject page says too.
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
  /** The last day for new lessons: the exam's final stretch, or the target date. */
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
  /** When no daily time covers everything: what the most time a day covers, when it's more. */
  maximum: { coveredShare: number; dailyMinutes: number } | null;
  /**
   * What `coveredShare` is a share of: the exam's questions and points (the notice's subjects, each
   * shared among its skills by their exam weight), or the goal's skills by their weight.
   */
  measure: "exam" | "goal";
  /**
   * The daily time the goal needs (see `getTarget`): the fewest minutes that cover everything in
   * depth by the deadline, whether or not the learner's time does. Null without a deadline, or
   * when even the most time a day doesn't (`maximum` says what that covers).
   */
  recommendedMinutes: number | null;
  /**
   * How much of each skill fits before the deadline, from 0 to 1 (1 for a skill the learner
   * settled or finished): what `coveredShare` adds up.
   */
  skillFits: ReadonlyMap<string, number>;
  /**
   * The learner's own daily time covers everything by the deadline once the plan is planned again
   * at it, as `fits` measures it: the plan a switch to their time plans holds every topic, and the
   * plan as its graph sizes it is whole. True while `fits` is false when the plan as it stands
   * holds less than their time fits (a date they moved closer, then faster study). Never read off
   * `recommendedMinutes`: more time a day can cover less (a weekly mock takes a study day), so a
   * lower time that fits says nothing of theirs. False without a deadline.
   */
  timeCovers: boolean;
};

/** A whole percent more is what a learner can see: anything less isn't worth a switch. */
const PERCENT = 100;

/** "At 1 hour a day": the next step up when there's no deadline. */
const ALTERNATIVE_MINUTES = 60;
const ALTERNATIVE_STEP = 30;

function getDeadline(input: BuildPlanInput): Date | null {
  const { targetDate } = input.goal;

  if (!targetDate || !isExamSchedule(input.goal)) {
    return targetDate;
  }

  const planStart = input.settings.startDate ? fromIsoDate(input.settings.startDate) : input.today;
  const windows = getExamWindows({ planStart, targetDate });

  return windows.find((window) => window.kind === "finalStretch")?.startDate ?? targetDate;
}

function isWhole(built: BuiltPlan): boolean {
  return built.droppedSkillIds.length === 0;
}

/**
 * The plan as it ends by its date: an exam that studies everything is measured without what goes
 * on after the exam, so what fits, the share it covers and the time to recommend all mean "by the
 * exam" whichever the learner chose.
 */
function byDate(input: BuildPlanInput): BuildPlanInput {
  return input.settings.fullCourse
    ? { ...input, settings: { ...input.settings, fullCourse: false } }
    : input;
}

/** The plan studying everything: an exam's going on after the exam, any other goal's without a date. */
function studyingEverything(input: BuildPlanInput): BuildPlanInput {
  return input.goal.kind === "exam"
    ? { ...input, settings: { ...input.settings, fullCourse: true } }
    : { ...input, goal: { ...input.goal, targetDate: null } };
}

/**
 * Whether the learner's time covers everything in depth by the plan's date, as the plan's graph
 * sizes it (see `toSizedPlanInput`).
 */
export function fitsInDepth(input: BuildPlanInput): boolean {
  return isWhole(buildPlan(toSizedPlanInput(byDate(input)).input));
}

/** When the learner finishes everything at their time, studying it all (see `studyingEverything`). */
function getFullCourseEnd(input: BuildPlanInput): Date | null {
  return buildPlan(toSizedPlanInput(studyingEverything(input)).input).estimate.endDate;
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
 * What the most time a day covers, unless the learner already gives it or it covers no more than
 * their time: a switch that changes nothing isn't offered.
 */
function getMaximum({
  coveredShare,
  examSubjects,
  planAt,
  sized,
  studyScheduleAt,
}: {
  coveredShare: number;
  examSubjects: readonly ExamSubjectShare[] | null;
  planAt: (dailyMinutes: number) => BuiltPlan;
  sized: SizedPlanInput;
  studyScheduleAt?: StudyScheduleAt;
}): PlanFeasibility["maximum"] {
  /** A weekend can normalize this scalar to the maximum while weekdays can still increase. */
  if (!studyScheduleAt && sized.input.goal.dailyMinutes >= MAX_DAILY_MINUTES) {
    return null;
  }

  const atMaximum = {
    ...sized,
    input: withDailyMinutes(sized.input, MAX_DAILY_MINUTES, studyScheduleAt),
  };

  const built = planAt(MAX_DAILY_MINUTES);
  const maximum = getCoverage({ built, examSubjects, sized: atMaximum }).coveredShare;

  return Math.round(maximum * PERCENT) > Math.round(coveredShare * PERCENT)
    ? { coveredShare: maximum, dailyMinutes: MAX_DAILY_MINUTES }
    : null;
}

/**
 * The daily time the goal needs: the fewest minutes that cover everything in depth by its date,
 * whatever the learner gives now (when their time covers it, the search starts below it), else
 * what the most time a day covers, unless that reads as everything ("even at 4 h a day, the plan
 * covers 100%" says nothing a learner can use): then the most time is the time that covers
 * everything. A time covers everything as `fits` says it: the plan as its graph sizes it is whole,
 * and the plan a switch to that time plans holds every topic (`holdsEveryTopic`). Read from the
 * graph alone, Pedro's Plan offered "10 min a day covers everything" beside his 15: the Library
 * wrote four lessons for each topic the graph sized at one, and 10 minutes brought back 3 of the 5
 * topics his date had left out. Every screen that offers a daily time recommends this one, before
 * the learner chooses (onboarding's time question) and after.
 */
function getTarget({
  built,
  coveredShare,
  examSubjects,
  fits,
  holdsEveryTopic,
  sized,
  studyScheduleAt,
}: {
  built: BuiltPlan;
  coveredShare: number;
  examSubjects: readonly ExamSubjectShare[] | null;
  fits: boolean;
  /** The plan a switch to that daily time plans holds every topic. */
  holdsEveryTopic: (dailyMinutes: number) => boolean;
  sized: SizedPlanInput;
  studyScheduleAt?: StudyScheduleAt;
}): Pick<PlanFeasibility, "maximum" | "recommendedMinutes"> {
  const planAt = planAtMinutes(sized.input, studyScheduleAt);

  const recommendedMinutes = findFittingMinutes({
    /** A lower daily time can fit before an extra mock takes away lesson capacity. */
    above: 0,
    fits: isWhole,
    holds: holdsEveryTopic,
    mayFit: mayFitInDepthAtMinutes({ built, sized, studyScheduleAt }),
    planAt,
  });

  if (recommendedMinutes !== null || fits) {
    return { maximum: null, recommendedMinutes };
  }

  const maximum = getMaximum({ coveredShare, examSubjects, planAt, sized, studyScheduleAt });

  if (!maximum || Math.round(maximum.coveredShare * PERCENT) < PERCENT) {
    return { maximum, recommendedMinutes: null };
  }

  return {
    maximum: null,
    recommendedMinutes: holdsEveryTopic(MAX_DAILY_MINUTES) ? MAX_DAILY_MINUTES : null,
  };
}

/**
 * What the learner's time covers and what more time would change: whether every topic is in from
 * the plan they study (`planned`, built from `input`), the rest from the plan as its graph sizes it
 * (see `toSizedPlanInput`).
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
  const dated = byDate(input);
  const sized = toSizedPlanInput(dated);
  const built = buildPlan(sized.input);
  const deadline = getDeadline(sized.input);
  // What the learner showed they know, as the syllabus says it: answered right only in practice,
  // a class test's nucleus counted as in while the syllabus showed it out for time.
  const known = input.knownSkillIds ?? new Set<string>();
  const plannedByDate = dated === input ? planned : buildPlan(dated);
  const coreFits = hasEveryTopic({ built: plannedByDate, known, skills: input.graph.skills });
  const fits = coreFits && isWhole(built);
  const { coveredShare, measure, skillFits } = getCoverage({ built, examSubjects, sized });
  const fullCourseEndDate = once(() => (deadline && !fits ? getFullCourseEnd(input) : null));

  // The plan as a switch to another daily time plans it, built once per time asked about.
  const plannedAt = once(() => planAtMinutes(dated, studyScheduleAt));

  const holdsEveryTopic = (dailyMinutes: number) =>
    hasEveryTopic({ built: plannedAt()(dailyMinutes), known, skills: input.graph.skills });

  const timeCovers = once(
    () => deadline !== null && isWhole(built) && holdsEveryTopic(input.goal.dailyMinutes),
  );

  const target = once(() =>
    deadline
      ? getTarget({
          built,
          coveredShare,
          examSubjects,
          fits,
          holdsEveryTopic,
          sized,
          studyScheduleAt,
        })
      : { maximum: null, recommendedMinutes: null },
  );

  const alternative = once(() => (deadline ? null : getAlternative({ built, input: sized.input })));

  const fittingDate = once(() =>
    input.goal.kind !== "exam" && deadline && !fits && target().recommendedMinutes === null
      ? findFittingDate({
          end: fullCourseEndDate(),
          fitsBy: (targetDate) => fitsInDepth({ ...input, goal: { ...input.goal, targetDate } }),
        })
      : null,
  );

  const coreMinutes = once(() =>
    coreFits
      ? null
      : findFittingMinutes({
          above: 0,
          fits: (candidate) =>
            hasEveryTopic({ built: candidate, known, skills: input.graph.skills }),
          planAt: plannedAt(),
        }),
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
    get endDate() {
      return (input.settings.fullCourse ? fullCourseEndDate() : null) ?? built.estimate.endDate;
    },
    fits,
    get fittingDate() {
      return fittingDate();
    },
    get fullCourseEndDate() {
      return fullCourseEndDate();
    },
    get maximum() {
      return target().maximum;
    },
    measure,
    get recommendedMinutes() {
      return target().recommendedMinutes;
    },
    skillFits,
    get timeCovers() {
      return timeCovers();
    },
  };
}

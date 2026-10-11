import { once } from "@zoonk/utils/once";
import { type BuildPlanInput, type BuiltPlan, buildPlan } from "./build-plan";
import { getKeptBaseChoices } from "./chosen-bases";
import { findFittingMinutes, planAtMinutes, withDailyMinutes } from "./daily-time-plans";
import { deepensMostAsked, hasEveryTopic } from "./feasibility-topics";
import { findFittingDate } from "./fitting-date";
import { getSkillArea } from "./graph-areas";
import { getBaseChoices } from "./plan-bases";
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
};

/**
 * A notice subject the plan teaches: the plan's areas it gathers and its share of the exam, so an
 * exam's coverage counts what its questions are worth.
 */
export type ExamSubjectShare = { areas: readonly string[]; share: number };

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

type CoveredSkill = { area: string; skillId: string; weight: number };

/**
 * What each skill is worth to an exam: its subject's share of the exam, shared among the subject's
 * skills by their exam weight. Skills outside the notice's subjects (study strategy, say) aren't
 * questions of the exam. Null when no subject has a share.
 */
function getExamWorth({
  examSubjects,
  skills,
}: {
  examSubjects: readonly ExamSubjectShare[];
  skills: readonly CoveredSkill[];
}): Map<string, number> | null {
  const worth = examSubjects.flatMap((subject) => {
    const own = skills.filter((skill) => subject.areas.includes(skill.area));
    const weight = own.reduce((total, skill) => total + skill.weight, 0);

    return weight > 0
      ? own.map((skill) => [skill.skillId, (subject.share * skill.weight) / weight] as const)
      : [];
  });

  return worth.some(([, value]) => value > 0) ? new Map(worth) : null;
}

/**
 * How much of each skill fits before the deadline: its finished lessons and what of the rest the
 * plan reaches, as a share of the skill's minutes. A skill with nothing left to plan fits whole.
 */
function getSkillFits({
  built,
  doneMinutes,
  skills,
}: {
  built: BuiltPlan;
  doneMinutes: ReadonlyMap<string, number>;
  skills: readonly { skillId: string }[];
}): Map<string, number> {
  const minutes = new Map(built.skillMinutes.map((entry) => [entry.skillId, entry]));

  return new Map(
    skills.map(({ skillId }) => {
      const entry = minutes.get(skillId);
      const done = doneMinutes.get(skillId) ?? 0;
      const total = done + (entry?.total ?? 0);
      const covered = done + (entry?.covered ?? 0);

      return [skillId, total > 0 ? Math.min(1, Math.max(0, covered / total)) : 1];
    }),
  );
}

/** The bases the learner chose to skip (see `BaseChoice`). */
function listSkippedBases(input: BuildPlanInput): Set<string> {
  const choices = getBaseChoices({ bases: input.bases ?? [], choices: getKeptBaseChoices(input) });

  return new Set([...choices].flatMap(([skillId, choice]) => (choice === "skip" ? [skillId] : [])));
}

/**
 * The share of the goal the plan covers before its deadline: each skill counts what it's worth
 * (its share of the exam, else its weight) times the share of its minutes that fit, including
 * what fits of a skill the plan can't finish, so more time always shows more.
 */
function getCoverage({
  built,
  examSubjects,
  sized,
}: {
  built: BuiltPlan;
  examSubjects: readonly ExamSubjectShare[] | null;
  sized: SizedPlanInput;
}): { coveredShare: number; measure: PlanFeasibility["measure"]; skillFits: Map<string, number> } {
  const { input } = sized;
  const skipped = new Set(input.settings.skippedAreas);
  const skippedBases = listSkippedBases(input);

  // What the learner took out (an area, a base they skip) isn't part of what's measured.
  const skills = input.graph.skills
    .map((skill) => ({
      area: getSkillArea({ graph: input.graph, skill }),
      skillId: skill.skillId,
      weight: skill.weight ?? 1,
    }))
    .filter((skill) => !skipped.has(skill.area) && !skippedBases.has(skill.skillId));

  const examWorth = examSubjects ? getExamWorth({ examSubjects, skills }) : null;
  const skillFits = getSkillFits({ built, doneMinutes: sized.doneMinutes, skills });

  const worthOf = (skill: CoveredSkill) =>
    examWorth ? (examWorth.get(skill.skillId) ?? 0) : skill.weight;

  const total = skills.reduce((sum, skill) => sum + worthOf(skill), 0);

  const covered = skills.reduce(
    (sum, skill) => sum + worthOf(skill) * (skillFits.get(skill.skillId) ?? 1),
    0,
  );

  return {
    coveredShare: total === 0 ? 1 : covered / total,
    measure: examWorth ? "exam" : "goal",
    skillFits,
  };
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
}: {
  coveredShare: number;
  examSubjects: readonly ExamSubjectShare[] | null;
  planAt: (dailyMinutes: number) => BuiltPlan;
  sized: SizedPlanInput;
}): PlanFeasibility["maximum"] {
  if (sized.input.goal.dailyMinutes >= MAX_DAILY_MINUTES) {
    return null;
  }

  const atMaximum = { ...sized, input: withDailyMinutes(sized.input, MAX_DAILY_MINUTES) };
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
 * everything. Every screen that offers a daily time recommends this one, before the learner
 * chooses (onboarding's time question) and after.
 */
function getTarget({
  coveredShare,
  examSubjects,
  fits,
  sized,
}: {
  coveredShare: number;
  examSubjects: readonly ExamSubjectShare[] | null;
  fits: boolean;
  sized: SizedPlanInput;
}): Pick<PlanFeasibility, "maximum" | "recommendedMinutes"> {
  const planAt = planAtMinutes(sized.input);

  const recommendedMinutes = findFittingMinutes({
    above: fits ? 0 : sized.input.goal.dailyMinutes,
    fits: isWhole,
    planAt,
  });

  if (recommendedMinutes !== null || fits) {
    return { maximum: null, recommendedMinutes };
  }

  const maximum = getMaximum({ coveredShare, examSubjects, planAt, sized });

  return maximum && Math.round(maximum.coveredShare * PERCENT) >= PERCENT
    ? { maximum: null, recommendedMinutes: maximum.dailyMinutes }
    : { maximum, recommendedMinutes: null };
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
}: {
  /** The notice's subjects with their share of the exam; null for goals that aren't exams. */
  examSubjects?: readonly ExamSubjectShare[] | null;
  input: BuildPlanInput;
  /** The plan `input` builds, when the caller already built it. */
  planned?: BuiltPlan;
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

  const target = once(() =>
    deadline
      ? getTarget({ coveredShare, examSubjects, fits, sized })
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
          above: input.goal.dailyMinutes,
          fits: (candidate) =>
            hasEveryTopic({ built: candidate, known, skills: input.graph.skills }),
          planAt: planAtMinutes(dated),
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
  };
}

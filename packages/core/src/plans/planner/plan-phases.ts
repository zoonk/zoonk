import { addDays, daysBetween, fromIsoDate } from "./plan-calendar";
import { type PlanPhase, type PlanPhaseKind, type PracticeBias } from "./plan-state";
import { getShortExamPhaseDays, isShortExam } from "./short-exam-plan";

type ExamPhaseKind = Exclude<PlanPhaseKind, "afterExam" | "learn">;

/** A time-boxed exam phase: the first and last study day it covers. */
export type ExamWindow = { endDate: Date; kind: ExamPhaseKind; startDate: Date };

/**
 * The share of each day's time that goes to new lessons; the rest is reviews and practice: a lesson
 * at half the time takes twice its minutes of study. Exam phases shrink new learning as the date
 * nears, and the final stretch has none.
 */
const LEARNING_SHARE: Record<PlanPhaseKind, number> = {
  afterExam: 0.5,
  finalStretch: 0,
  foundations: 0.6,
  gaps: 0.5,
  learn: 0.5,
  practice: 0.35,
};

const PRACTICE_BIAS_FACTOR: Record<PracticeBias, number> = {
  balanced: 1,
  moreExplanation: 1.2,
  morePractice: 0.8,
};

const MAX_LEARNING_SHARE = 0.8;

/** The final stretch is the last two weeks, or about a sixth of a shorter plan. */
const FINAL_STRETCH_MAX_DAYS = 14;
const FINAL_STRETCH_MIN_DAYS = 2;
const FINAL_STRETCH_SHARE = 0.15;

/** Before the final stretch: foundations 30%, gaps 40% and practice the rest. */
const FOUNDATIONS_SHARE = 0.3;
const GAPS_SHARE = 0.4;

export function getLearningShare({
  phaseKind,
  practiceBias,
}: {
  phaseKind: PlanPhaseKind;
  practiceBias: PracticeBias;
}): number {
  return Math.min(
    MAX_LEARNING_SHARE,
    LEARNING_SHARE[phaseKind] * PRACTICE_BIAS_FACTOR[practiceBias],
  );
}

function getFinalStretchDays(studyDays: number): number {
  return Math.min(
    FINAL_STRETCH_MAX_DAYS,
    Math.max(FINAL_STRETCH_MIN_DAYS, Math.round(studyDays * FINAL_STRETCH_SHARE)),
  );
}

/** A plan of more than a week: foundations, gaps, practice and the final stretch. */
function getLongExamPhaseDays(studyDays: number): [ExamPhaseKind, number][] {
  const finalDays = getFinalStretchDays(studyDays);
  const before = studyDays - finalDays;
  const foundations = Math.round(before * FOUNDATIONS_SHARE);
  const gaps = Math.round(before * GAPS_SHARE);

  return [
    ["foundations", foundations],
    ["gaps", gaps],
    ["practice", before - foundations - gaps],
    ["finalStretch", finalDays],
  ];
}

/**
 * Splits the days from the plan's start to the exam into its phases: foundations, gaps, practice
 * and the final stretch, or a short plan's days for a test a few days away. Phases too short to get
 * a day are left out. The exam day itself belongs to none.
 */
export function getExamWindows({
  planStart,
  targetDate,
}: {
  planStart: Date;
  targetDate: Date;
}): ExamWindow[] {
  const studyDays = daysBetween(planStart, targetDate);

  if (studyDays <= 0) {
    return [];
  }

  const lengths = isShortExam({ planStart, targetDate })
    ? getShortExamPhaseDays(studyDays)
    : getLongExamPhaseDays(studyDays);

  return lengths
    .filter(([, days]) => days > 0)
    .map(([kind, days], index, kept) => {
      const offset = kept.slice(0, index).reduce((total, [, length]) => total + length, 0);
      const startDate = addDays(planStart, offset);

      return { endDate: addDays(startDate, days - 1), kind, startDate };
    });
}

/** An exam's phases as the learner sees them, with their dates (see `getKeptExamWindows`). */
export function toExamWindows(phases: readonly PlanPhase[]): ExamWindow[] {
  return phases.flatMap(({ endDate, kind, startDate }) =>
    kind !== "afterExam" && kind !== "learn" && startDate && endDate
      ? [{ endDate: fromIsoDate(endDate), kind, startDate: fromIsoDate(startDate) }]
      : [],
  );
}

/**
 * An exam's phases for its date (see `getExamWindows`), keeping the one the learner is in open: a
 * new date that would end it before today lays it and the phases after it out again from today,
 * as a plan starting today would, the phase still starting where it did, and the phases behind
 * keep their dates. Ana moved ENEM from 400 days away to 36, two weeks into her foundations: laid
 * out from the plan's start, they ended two days earlier with 4 of their lessons done, and read as
 * finished. Once laid out for this date they're the ones shown, so the next day's plan keeps them.
 */
export function getKeptExamWindows({
  planStart,
  shown,
  targetDate,
  today,
}: {
  planStart: Date;
  /** The exam phases the learner sees, with their dates; empty for a new plan. */
  shown: readonly ExamWindow[];
  targetDate: Date;
  today: Date;
}): ExamWindow[] {
  const planned = getExamWindows({ planStart, targetDate });
  const current = findExamWindow({ date: today, windows: shown });
  const open = planned.find((window) => window.kind === current?.kind);

  if (!current || (open && open.endDate >= today)) {
    return planned;
  }

  if (shown.at(-1)?.endDate.getTime() === addDays(targetDate, -1).getTime()) {
    return [...shown];
  }

  const fresh = getExamWindows({ planStart: today, targetDate });
  const from = fresh.findIndex((window) => window.kind === current.kind);
  const [first] = fresh.slice(from);

  if (from === -1 || !first) {
    return planned;
  }

  return [
    ...shown.filter((window) => window.endDate < current.startDate),
    { ...first, startDate: current.startDate },
    ...fresh.slice(from + 1),
  ];
}

/** The exam phase a date falls in, or null outside the plan's days. */
export function findExamWindow({
  date,
  windows,
}: {
  date: Date;
  windows: readonly ExamWindow[];
}): ExamWindow | null {
  return windows.find((window) => window.startDate <= date && date <= window.endDate) ?? null;
}

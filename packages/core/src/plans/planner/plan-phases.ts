import { addDays, daysBetween, fromIsoDate } from "./plan-calendar";
import { type PlanPhase, type PlanPhaseKind, type PracticeBias } from "./plan-state";
import { getShortExamPhaseDays, isShortExam } from "./short-exam-plan";

type ExamPhaseKind = Exclude<PlanPhaseKind, "afterExam" | "learn">;

export type ExamWindow = { endDate: Date; kind: ExamPhaseKind; startDate: Date };

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

const FINAL_STRETCH_MAX_DAYS = 14;
const FINAL_STRETCH_MIN_DAYS = 2;
const FINAL_STRETCH_SHARE = 0.15;

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

export function toExamWindows(phases: readonly PlanPhase[]): ExamWindow[] {
  return phases.flatMap(({ endDate, kind, startDate }) =>
    kind !== "afterExam" && kind !== "learn" && startDate && endDate
      ? [{ endDate: fromIsoDate(endDate), kind, startDate: fromIsoDate(startDate) }]
      : [],
  );
}

export function getKeptExamWindows({
  planStart,
  shown,
  targetDate,
  today,
}: {
  planStart: Date;
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

export function findExamWindow({
  date,
  windows,
}: {
  date: Date;
  windows: readonly ExamWindow[];
}): ExamWindow | null {
  return windows.find((window) => window.startDate <= date && date <= window.endDate) ?? null;
}

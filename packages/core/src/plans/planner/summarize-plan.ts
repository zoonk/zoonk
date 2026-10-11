import { type AfterExamSpan } from "./after-exam";
import { countSkillLessons } from "./core-first";
import { listWonPhases } from "./phase-time";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { type PlannedItem } from "./plan-items";
import { type ExamWindow } from "./plan-phases";
import { type PlanGraph, type PlanPhase } from "./plan-state";
import { type QueueUnit } from "./plan-units";

type PlanEstimate = {
  /** The day the last planned item is due. */
  endDate: Date | null;
  remainingMinutes: number;
  totalMinutes: number;
};

export type PlanOutline = {
  estimate: PlanEstimate;
  phases: PlanPhase[];
  /**
   * Each planned skill's lessons, its stand-ins counted as the lessons they plan, before any cut
   * (`countSkillLessons`): the plan saves them as `plannedLessons`, which size the skill's core.
   */
  skillLessons: Map<string, number>;
};

function sumMinutes(items: readonly PlannedItem[]): number {
  return items.reduce((total, item) => total + item.minutes, 0);
}

function getDates(items: readonly PlannedItem[]): Date[] {
  return items
    .flatMap((item) => (item.scheduledFor ? [item.scheduledFor] : []))
    .toSorted((a, b) => a.getTime() - b.getTime());
}

function toIsoOrNull(date: Date | undefined): string | null {
  return date ? toIsoDate(date) : null;
}

/**
 * The day after the phases so far end: a phase starts once the ones before it end. A phase a
 * test-out finished keeps the day it was finished on, which can come before the phases ahead of
 * it end: started the day after it, the job search phase of a career plan came before its UX
 * process phase.
 */
function getDayAfterPrevious(phases: readonly PlanPhase[]): Date | null {
  const end = phases
    .flatMap((phase) => (phase.endDate ? [phase.endDate] : []))
    .toSorted()
    .at(-1);

  return end ? addDays(fromIsoDate(end), 1) : null;
}

/**
 * Where a phase with work left starts: the day after the one before it ends, or, for the plan's
 * first phase, the day its first item was done or this run's schedule starts, whichever is earlier.
 */
function getPhaseStart({
  inPhase,
  scheduleStart,
  summarized,
}: {
  inPhase: readonly PlannedItem[];
  scheduleStart: Date;
  summarized: readonly PlanPhase[];
}): Date | undefined {
  if (summarized.length > 0) {
    return getDayAfterPrevious(summarized) ?? undefined;
  }

  return [scheduleStart, ...getDates(inPhase)].toSorted((a, b) => a.getTime() - b.getTime())[0];
}

/**
 * Learn phases run one after another: a phase with work left starts the day after the one before
 * it ends (its first lessons can take several days before they're due; the first phase starts
 * when the plan does) and ends when its last item is due, or on the end the learner saw (`kept`)
 * when they won its challenge early. Lessons a test-out finished early don't date it, and a
 * finished phase keeps the dates of its items.
 */
function summarizeLearnPhases({
  graph,
  items,
  kept,
  scheduleStart,
}: {
  graph: PlanGraph;
  items: readonly PlannedItem[];
  kept: ReadonlyMap<number, Date>;
  scheduleStart: Date;
}) {
  const phases = graph.phases.length > 0 ? graph.phases : [{ milestone: null, name: "" }];
  const won = listWonPhases(items);

  return phases.reduce<PlanPhase[]>((summarized, phase, index) => {
    const inPhase = items.filter((item) => item.phase === index);
    const todo = inPhase.filter((item) => item.status === "todo");
    const held = won.has(index) ? kept.get(index) : undefined;
    const own = [...getDates(todo.length > 0 ? todo : inPhase), ...(held ? [held] : [])];
    const dates = own.toSorted((a, b) => a.getTime() - b.getTime());

    const start =
      (todo.length > 0 && getPhaseStart({ inPhase, scheduleStart, summarized })) || dates[0];

    const last = dates.at(-1);

    // A phase whose work all comes on the day the one before it ends (that one's challenge, which a
    // half-studied day left, right before its own) starts and ends that day: dated the day after,
    // a career's second phase read as ending a day later than its challenge.
    const first = start && last && last < start ? last : start;

    summarized.push({
      endDate: toIsoOrNull(last),
      kind: "learn",
      milestone: phase.milestone,
      minutes: Math.round(sumMinutes(inPhase)),
      name: phase.name,
      startDate: toIsoOrNull(first),
    });

    return summarized;
  }, []);
}

/**
 * The phase after the exam of a plan that studies everything (see `continueAfterExam`): the days
 * its work there spans and the time it takes, the rest of a stand-in started before the exam
 * included, whose lessons become items of the phase once the Library outlines them. Null when
 * nothing goes on after the exam.
 */
function summarizeAfterExam(span: AfterExamSpan | null): PlanPhase | null {
  if (!span) {
    return null;
  }

  return {
    endDate: toIsoDate(span.end),
    kind: "afterExam",
    milestone: null,
    minutes: Math.round(span.minutes),
    name: "",
    startDate: toIsoDate(span.start),
  };
}

/** Exam phases keep their windows, named by kind in the apps, and any phase after the exam. */
function summarizeExamPhases({
  afterExam,
  items,
  windows,
}: {
  afterExam: AfterExamSpan | null;
  items: readonly PlannedItem[];
  windows: readonly ExamWindow[];
}) {
  const after = summarizeAfterExam(afterExam);

  return [
    ...windows.map((window, index): PlanPhase => ({
      endDate: toIsoDate(window.endDate),
      kind: window.kind,
      milestone: null,
      minutes: Math.round(sumMinutes(items.filter((item) => item.phase === index))),
      name: "",
      startDate: toIsoDate(window.startDate),
    })),
    ...(after ? [after] : []),
  ];
}

/**
 * The phases with their dates and size, the whole plan's estimate (it ends on its last item's day,
 * or the last day its work after the exam takes, `afterExam`, whichever comes later) and each
 * skill's lessons.
 */
export function summarizePlan({
  afterExam = null,
  graph,
  items,
  kept = new Map(),
  queue = [],
  scheduleStart,
  windows,
}: {
  afterExam?: AfterExamSpan | null;
  graph: PlanGraph;
  items: readonly PlannedItem[];
  /** The phase ends the run keeps, the ones the learner saw (see `getShownPhaseEnds`). */
  kept?: ReadonlyMap<number, Date>;
  /**
   * Every unit the run planned from, before any cut (`buildPlanQueue`), less the lessons whose
   * title another lesson of the plan holds (see `withoutRepeatedTitles`): the plan teaches them
   * once, so they aren't the skill's.
   */
  queue?: readonly QueueUnit[];
  /** The first day this run schedules new work on. */
  scheduleStart: Date;
  windows: readonly ExamWindow[];
}): PlanOutline {
  const todo = items.filter((item) => item.status === "todo");
  const ends = [getDates(items).at(-1), afterExam?.end].filter((date) => date !== undefined);

  return {
    estimate: {
      endDate: ends.toSorted((a, b) => a.getTime() - b.getTime()).at(-1) ?? null,
      remainingMinutes: Math.round(sumMinutes(todo)),
      totalMinutes: Math.round(sumMinutes(items)),
    },
    phases:
      windows.length > 0
        ? summarizeExamPhases({ afterExam, items, windows })
        : summarizeLearnPhases({ graph, items, kept, scheduleStart }),
    skillLessons: countSkillLessons(queue),
  };
}

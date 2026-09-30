import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { type PlannedItem } from "./plan-items";
import { type ExamWindow } from "./plan-phases";
import { type PlanGraph, type PlanPhase } from "./plan-state";

type PlanEstimate = {
  /** The day the last planned item is due. */
  endDate: Date | null;
  remainingMinutes: number;
  totalMinutes: number;
};

export type PlanOutline = { estimate: PlanEstimate; phases: PlanPhase[] };

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

/** The day after the last dated phase so far: a phase starts once the one before it ends. */
function getDayAfterPrevious(phases: readonly PlanPhase[]): Date | null {
  const end = phases.findLast((phase) => phase.endDate)?.endDate;
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
 * when the plan does) and ends when its last item is due. Lessons a test-out finished early don't
 * date it, and a finished phase keeps the dates of its items.
 */
function summarizeLearnPhases({
  graph,
  items,
  scheduleStart,
}: {
  graph: PlanGraph;
  items: readonly PlannedItem[];
  scheduleStart: Date;
}) {
  const phases = graph.phases.length > 0 ? graph.phases : [{ milestone: null, name: "" }];

  return phases.reduce<PlanPhase[]>((summarized, phase, index) => {
    const inPhase = items.filter((item) => item.phase === index);
    const todo = inPhase.filter((item) => item.status === "todo");
    const dates = getDates(todo.length > 0 ? todo : inPhase);

    const start =
      (todo.length > 0 && getPhaseStart({ inPhase, scheduleStart, summarized })) || dates[0];

    const last = dates.at(-1);

    summarized.push({
      endDate: toIsoOrNull(start && last && last < start ? start : last),
      kind: "learn",
      milestone: phase.milestone,
      minutes: Math.round(sumMinutes(inPhase)),
      name: phase.name,
      startDate: toIsoOrNull(start),
    });

    return summarized;
  }, []);
}

/** Exam phases keep their windows, named by kind in the apps. */
function summarizeExamPhases({
  items,
  windows,
}: {
  items: readonly PlannedItem[];
  windows: readonly ExamWindow[];
}) {
  return windows.map((window, index): PlanPhase => ({
    endDate: toIsoDate(window.endDate),
    kind: window.kind,
    milestone: null,
    minutes: Math.round(sumMinutes(items.filter((item) => item.phase === index))),
    name: "",
    startDate: toIsoDate(window.startDate),
  }));
}

/** The phases with their dates and size, and the whole plan's estimate. */
export function summarizePlan({
  graph,
  items,
  scheduleStart,
  windows,
}: {
  graph: PlanGraph;
  items: readonly PlannedItem[];
  /** The first day this run schedules new work on. */
  scheduleStart: Date;
  windows: readonly ExamWindow[];
}): PlanOutline {
  const todo = items.filter((item) => item.status === "todo");

  return {
    estimate: {
      endDate: getDates(items).at(-1) ?? null,
      remainingMinutes: Math.round(sumMinutes(todo)),
      totalMinutes: Math.round(sumMinutes(items)),
    },
    phases:
      windows.length > 0
        ? summarizeExamPhases({ items, windows })
        : summarizeLearnPhases({ graph, items, scheduleStart }),
  };
}

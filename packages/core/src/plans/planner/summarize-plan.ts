import { type AfterExamSpan } from "./after-exam";
import { countSkillLessons } from "./core-first";
import { listWonPhases } from "./phase-time";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { type PlannedItem } from "./plan-items";
import { type ExamWindow } from "./plan-phases";
import { type PlanGraph, type PlanPhase, type PlanSettings } from "./plan-state";
import { type QueueUnit } from "./plan-units";

type PlanEstimate = { endDate: Date | null; remainingMinutes: number; totalMinutes: number };

export type PlanOutline = {
  estimate: PlanEstimate;
  phases: PlanPhase[];
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

function getDayAfterPrevious(phases: readonly PlanPhase[]): Date | null {
  const end = phases
    .flatMap((phase) => (phase.endDate ? [phase.endDate] : []))
    .toSorted()
    .at(-1);

  return end ? addDays(fromIsoDate(end), 1) : null;
}

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

function summarizeLearnPhases({
  challengesLeftOut,
  graph,
  items,
  kept,
  scheduleStart,
}: {
  challengesLeftOut: ReadonlySet<number>;
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

    const first = start && last && last < start ? last : start;

    summarized.push({
      ...(phase.later && { later: true }),
      ...(challengesLeftOut.has(index) && { challengeLeftOut: true }),
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

type WritingDay = NonNullable<PlanSettings["writingSchedule"]>[number];

export function sumWriting(schedule: readonly WritingDay[]): number {
  return schedule.reduce((sum, { minutes }) => sum + minutes, 0);
}

function summarizeExamPhases({
  afterExam,
  items,
  windows,
  writingSchedule,
}: {
  afterExam: AfterExamSpan | null;
  items: readonly PlannedItem[];
  windows: readonly ExamWindow[];
  writingSchedule: readonly WritingDay[];
}) {
  const after = summarizeAfterExam(afterExam);

  return [
    ...windows.map((window, index): PlanPhase => ({
      endDate: toIsoDate(window.endDate),
      kind: window.kind,
      milestone: null,
      minutes: Math.round(
        sumMinutes(items.filter((item) => item.phase === index)) +
          sumWriting(
            writingSchedule.filter(
              ({ date }) =>
                date >= toIsoDate(window.startDate) && date <= toIsoDate(window.endDate),
            ),
          ),
      ),
      name: "",
      startDate: toIsoDate(window.startDate),
    })),
    ...(after ? [after] : []),
  ];
}

export function summarizePlan({
  afterExam = null,
  challengesLeftOut = new Set(),
  graph,
  items,
  kept = new Map(),
  queue = [],
  scheduleStart,
  windows,
  writingSchedule = [],
}: {
  afterExam?: AfterExamSpan | null;
  challengesLeftOut?: ReadonlySet<number>;
  graph: PlanGraph;
  items: readonly PlannedItem[];
  kept?: ReadonlyMap<number, Date>;
  queue?: readonly QueueUnit[];
  scheduleStart: Date;
  windows: readonly ExamWindow[];
  writingSchedule?: readonly WritingDay[];
}): PlanOutline {
  const todo = items.filter((item) => item.status === "todo");
  const lastWriting = writingSchedule.at(-1);

  const ends = [
    getDates(items).at(-1),
    afterExam?.end,
    lastWriting && new Date(lastWriting.date),
  ].filter((date) => date !== undefined);

  const start = toIsoDate(scheduleStart);

  return {
    estimate: {
      endDate: ends.toSorted((a, b) => a.getTime() - b.getTime()).at(-1) ?? null,
      remainingMinutes: Math.round(
        sumMinutes(todo) + sumWriting(writingSchedule.filter(({ date }) => date >= start)),
      ),
      totalMinutes: Math.round(sumMinutes(items) + sumWriting(writingSchedule)),
    },
    phases:
      windows.length > 0
        ? summarizeExamPhases({ afterExam, items, windows, writingSchedule })
        : summarizeLearnPhases({ challengesLeftOut, graph, items, kept, scheduleStart }),
    skillLessons: countSkillLessons(queue),
  };
}

export function listDroppedSkills(dropped: readonly { depth?: boolean; skillId: string | null }[]) {
  return {
    droppedSkillIds: [...new Set(dropped.flatMap((unit) => (unit.skillId ? [unit.skillId] : [])))],
    waitingSkillIds: [
      ...new Set(dropped.flatMap((unit) => (unit.skillId && !unit.depth ? [unit.skillId] : []))),
    ],
  };
}

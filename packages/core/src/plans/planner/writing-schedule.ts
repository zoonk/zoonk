import { type loadScheduledAnswers } from "../../learner/facts/scheduled-answers";
import { type PlanSettings } from "./plan-state";

type Schedule = NonNullable<PlanSettings["writingSchedule"]>;
type Answer = Schedule[number]["tasks"][number];
type Attempts = Awaited<ReturnType<typeof loadScheduledAnswers>>;
type WritingDay = Schedule[number];
type Occurrence = { entry: WritingDay; index: number; task: Answer };
type WritingScheduleInput = { attempts: Attempts; schedule: Schedule; today: string };

/** The retained placement already took the first turn. Carry only minutes its old days didn't reserve. */
export function getPlacementCarry(schedule: Schedule, taskKey: string | undefined) {
  const placement = schedule.findLast((entry) =>
    entry.tasks.some((task) => task.placement && task.taskKey === taskKey),
  );

  const task = placement?.tasks.find((answer) => answer.placement && answer.taskKey === taskKey);

  if (!placement || !task) {
    return { next: 0, remaining: 0 };
  }

  let remaining = task.minutes - placement.minutes;

  for (const entry of schedule) {
    if (entry.date > placement.date) {
      if (entry.test || entry.tasks.length > 0) {
        return { next: 1, remaining: 0 };
      }

      remaining -= entry.minutes;
    }
  }

  return { next: 1, remaining: Math.max(0, remaining) };
}

function compareOccurrences(a: Occurrence, b: Occurrence) {
  const aPlacement = Boolean(a.task.placement);
  const bPlacement = Boolean(b.task.placement);

  if (aPlacement !== bPlacement) {
    return aPlacement ? -1 : 1;
  }

  return aPlacement
    ? a.entry.date.localeCompare(b.entry.date)
    : b.entry.date.localeCompare(a.entry.date);
}

function matchStartedAnswers({ attempts, schedule, today }: WritingScheduleInput) {
  const available = Map.groupBy(
    attempts.filter(({ date }) => date <= today).toSorted((a, b) => a.date.localeCompare(b.date)),
    ({ taskKey }) => taskKey,
  );

  // Give the reserved placement its attempt first, even when it happened on a later practice day.
  // Regular attempts satisfy their own day before an older occurrence they could also match.
  const occurrences = schedule
    .filter(({ test }) => !test)
    .flatMap((entry) => entry.tasks.map((task, index) => ({ entry, index, task })))
    .toSorted(compareOccurrences);

  const started = new Map<WritingDay, Set<number>>();

  for (const { entry, index, task } of occurrences) {
    const candidates = available.get(task.taskKey);

    const found =
      candidates?.findIndex((attempt) =>
        task.placement ? attempt.placement : attempt.date >= entry.date,
      ) ?? -1;

    if (candidates && found !== -1) {
      candidates.splice(found, 1);
      const indices = started.get(entry) ?? new Set<number>();
      indices.add(index);
      started.set(entry, indices);
    }
  }

  return (entry: WritingDay) => {
    const indices = started.get(entry);
    return indices ? entry.tasks.filter((_, index) => !indices.has(index)) : entry.tasks;
  };
}

function getOfferedWriting({
  schedule,
  today,
  unstarted,
}: {
  schedule: Schedule;
  today: string;
  unstarted: ReturnType<typeof matchStartedAnswers>;
}) {
  const allocated = schedule.find(({ date }) => date === today);

  if (allocated?.test) {
    return allocated;
  }

  if (allocated?.tasks.length) {
    const tasks = unstarted(allocated);

    if (tasks.length > 0) {
      return { ...allocated, tasks };
    }
  }

  // A continuation is the empty slot following an oversized answer. The original block carries
  // across days once admitted, so a new day only needs to offer work the learner never started.
  const previous =
    allocated?.tasks.length === 0
      ? schedule.findLast(({ date, tasks, test }) => date < today && (test || tasks.length > 0))
      : undefined;

  const continuation =
    previous && !previous.test
      ? unstarted(previous).find((task) => task.minutes > previous.minutes)
      : undefined;

  if (previous && continuation) {
    return { ...previous, date: today, tasks: [continuation] };
  }

  // Missing the whole reserved window must still leave the initial writing practice reachable.
  const missed = schedule.findLast(
    (entry) => entry.date < today && unstarted(entry).some((task) => task.placement),
  );

  const placement = missed && unstarted(missed).find((task) => task.placement);

  return missed && placement ? { ...missed, date: today, tasks: [placement] } : undefined;
}

export function resolveWritingDay(input: WritingScheduleInput) {
  return getOfferedWriting({ ...input, unstarted: matchStartedAnswers(input) });
}

export type WritingWork = { date: string; minutes: number; test: boolean };

export function listRemainingWriting(input: WritingScheduleInput): WritingWork[] {
  const { attempts, schedule, today } = input;
  const unstarted = matchStartedAnswers(input);
  const offered = getOfferedWriting({ schedule, today, unstarted });

  const active = attempts.filter(({ completed, date }) => !completed && date <= today);
  const future = schedule.filter(({ date }) => date > today);

  const upcoming = [
    ...(offered ? [offered] : []),
    ...future.map((entry) => ({ ...entry, tasks: unstarted(entry) })),
  ];

  return [
    ...active.map(({ minutes }) => ({ date: today, minutes, test: false })),
    ...upcoming.flatMap((entry) =>
      entry.test
        ? [{ date: entry.date, minutes: entry.minutes, test: true }]
        : entry.tasks.map(({ minutes }) => ({ date: entry.date, minutes, test: false })),
    ),
  ];
}

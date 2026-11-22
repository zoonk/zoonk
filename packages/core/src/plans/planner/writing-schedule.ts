import { type loadScheduledAnswers } from "../../learner/facts/scheduled-answers";
import { type PlanSettings } from "./plan-state";

type Schedule = NonNullable<PlanSettings["writingSchedule"]>;
type Answer = Schedule[number]["tasks"][number];
type Attempts = Awaited<ReturnType<typeof loadScheduledAnswers>>;

function hasStartedAnswer({
  attempts,
  date,
  end,
  task,
}: {
  attempts: Attempts;
  date: string;
  end: string;
  task: Answer;
}) {
  return attempts.some(
    (attempt) =>
      attempt.taskKey === task.taskKey &&
      attempt.date <= end &&
      (task.placement ? attempt.placement : attempt.date >= date),
  );
}

export function resolveWritingDay({
  attempts,
  schedule,
  today,
}: {
  attempts: Attempts;
  schedule: Schedule;
  today: string;
}) {
  const allocated = schedule.find(({ date }) => date === today);

  if (allocated?.test) {
    return allocated;
  }

  const unstarted = (entry: Schedule[number], task: Answer) =>
    !hasStartedAnswer({ attempts, date: entry.date, end: today, task });

  if (allocated?.tasks.length) {
    const tasks = allocated.tasks.filter((task) => unstarted(allocated, task));

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
      ? previous.tasks.find((task) => task.minutes > previous.minutes && unstarted(previous, task))
      : undefined;

  if (previous && continuation) {
    return { ...previous, date: today, tasks: [continuation] };
  }

  // Missing the whole reserved window must still leave the initial writing practice reachable.
  const missed = schedule.findLast(
    (entry) =>
      entry.date < today && entry.tasks.some((task) => task.placement && unstarted(entry, task)),
  );

  const placement = missed?.tasks.find((task) => task.placement && unstarted(missed, task));

  return missed && placement ? { ...missed, date: today, tasks: [placement] } : undefined;
}

export type WritingWork = { date: string; minutes: number; test: boolean };

export function listRemainingWriting({
  attempts,
  schedule,
  today,
}: {
  attempts: Attempts;
  schedule: Schedule;
  today: string;
}): WritingWork[] {
  const offered = resolveWritingDay({ attempts, schedule, today });

  const active = attempts.filter(({ completed, date }) => !completed && date <= today);
  const future = schedule.filter(({ date }) => date > today);
  const upcoming = [...(offered ? [offered] : []), ...future];

  return [
    ...active.map(({ minutes }) => ({ date: today, minutes, test: false })),
    ...upcoming.flatMap((entry) =>
      entry.test
        ? [{ date: entry.date, minutes: entry.minutes, test: true }]
        : entry.tasks
            .filter((task) => !hasStartedAnswer({ attempts, date: entry.date, end: today, task }))
            .map(({ minutes }) => ({ date: entry.date, minutes, test: false })),
    ),
  ];
}

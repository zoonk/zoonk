import { type PlannedProduce, WRITING_DRILL_MINUTES } from "../../exams/essays/produce-block";
import { MIN_BLOCK_MINUTES } from "../../sessions/block-minutes";
import { averageWeight } from "./area-shares";
import { type BuildPlanInput } from "./build-plan";
import { getKeptBaseChoices, withBaseChoices } from "./chosen-bases";
import { getSkillArea } from "./graph-areas";
import { getSpendable } from "./mock-day";
import { toIsoDate } from "./plan-calendar";
import { type PlanSettings } from "./plan-state";
import { type QueueUnit } from "./plan-units";
import { type DroppedUnit, type PlanDay } from "./schedule-units";
import { getPlacementCarry, getWritingTarget, keepWritingSchedule } from "./writing-schedule";
import { isWrittenDay } from "./written-cadence";
import { scheduleWrittenPapers } from "./written-test-planning";

type Answer = PlannedProduce & { unit: "answer" };
type Paper = { day: number | null; minutes: number; title: string; tasks: Answer[] };

export type PlanWriting = { practice: Answer[]; skillIds: ReadonlySet<string>; tests: Paper[] };

type Entry = NonNullable<PlanSettings["writingSchedule"]>[number];

const MAX_TEACHING_SHARE = 0.2;

function getWrittenShare(input: BuildPlanInput): number {
  const { graph, settings, writing } = input;
  const skipped = new Set(settings.skippedAreas);
  const areas = Map.groupBy(graph.skills, (skill) => getSkillArea({ graph, skill }));

  const weights = [...areas].flatMap(([area, skills]) =>
    skipped.has(area) ? [] : [{ skills, weight: averageWeight(skills) }],
  );

  const total = weights.reduce((sum, { weight }) => sum + weight, 0);

  const written = weights.reduce((sum, { skills, weight }) => {
    const count = skills.filter(({ skillId }) => writing?.skillIds.has(skillId)).length;
    return sum + (count / skills.length) * weight;
  }, 0);

  return total > 0 ? written / total : 0;
}

function getWritingRoom({ shape }: PlanDay): number {
  if (shape.events.some(({ kind, replacesDay }) => kind === "mock" || replacesDay)) {
    return 0;
  }

  return Math.max(0, Math.floor(getSpendable(shape) - (shape.reserved ?? 0)));
}

export function getMinimumWritingCost({
  days,
  input,
}: {
  days: readonly PlanDay["shape"][];
  input: BuildPlanInput;
}): number {
  if (!input.writing || input.todayShown || input.openedKeys?.length || input.landedOnly) {
    return 0;
  }

  const studyMinutes = days.reduce((total, day) => total + day.minutes, 0);
  const teachingDays = days.filter(({ minutes, open, share }) => minutes > 0 && open && share > 0);

  if (teachingDays.length === 0 || input.writing.practice.length === 0) {
    return 0;
  }

  const selected = withBaseChoices({ choices: getKeptBaseChoices(input), input });
  const written = studyMinutes * getWrittenShare(selected);

  const target = getWritingTarget({
    budget: written * (1 - MAX_TEACHING_SHARE),
    practice: input.writing.practice,
  });

  const outsideLessons = days
    .filter(({ open, share }) => !open || share === 0)
    .reduce((total, day) => total + day.minutes, 0);

  const lowestTeachingShare = Math.min(...teachingDays.map(({ share }) => share));
  return Math.max(0, target - outsideLessons) * lowestTeachingShare;
}

type WritingProgress = {
  accrued: number;
  next: number;
  remaining: number;
  room: number;
  spent: number;
};

function takeWriting({
  budget,
  day,
  inCadence,
  practice,
  state,
}: {
  budget: number;
  day: { date: string; minutes: number };
  inCadence: boolean;
  practice: readonly Answer[];
  state: WritingProgress;
}): Entry | null {
  const entry: Entry = { date: day.date, minutes: 0, tasks: [] };

  if (state.remaining > 0) {
    entry.minutes = Math.min(day.minutes, state.remaining);
    state.remaining -= entry.minutes;
    return entry;
  }

  while (entry.minutes < day.minutes) {
    const task = practice[state.next % practice.length];
    const first = state.next === 0 && task?.placement;
    const roomToday = day.minutes - entry.minutes;

    if (
      !task ||
      (!first && (!inCadence || state.spent + task.minutes / 2 > Math.min(budget, state.accrued)))
    ) {
      break;
    }

    if (
      !first &&
      (task.minutes > state.room || (entry.tasks.length > 0 && task.minutes > roomToday))
    ) {
      break;
    }

    const part = Math.min(roomToday, task.minutes);
    entry.minutes += part;
    entry.tasks.push({ ...task, placement: Boolean(first) });
    state.next += 1;
    state.remaining = task.minutes - part;
    state.spent += task.minutes;
  }

  return entry.minutes > 0 ? entry : null;
}

function listWritingSchedule({
  days,
  input,
  planStart,
  practiceBudget,
  start,
  targetDate,
  writing,
}: {
  days: readonly PlanDay[];
  input: BuildPlanInput;
  planStart: Date;
  practiceBudget: number;
  start: Date;
  targetDate: Date | null;
  writing: PlanWriting;
}): Entry[] {
  const studyDays = days.map((day) => ({
    date: toIsoDate(day.date),
    minutes: getWritingRoom(day),
  }));

  const today = toIsoDate(input.today);

  const retained = (input.settings.writingSchedule ?? []).filter(
    ({ date }) => date < toIsoDate(start) || (input.todayShown && date === today),
  );

  const kept =
    input.settings.skippedAreas.length > 0
      ? keepWritingSchedule(retained, new Set(writing.practice.map(({ taskKey }) => taskKey)))
      : retained;

  const keptByDate = new Map(kept.map((entry) => [entry.date, entry]));

  const tests = targetDate
    ? scheduleWrittenPapers({ studyDays, targetDate, tests: writing.tests })
    : new Map<string, Paper>();

  // A saved schedule is what the learner was shown: today keeps its writing, none included.
  const shown = input.todayShown && input.settings.writingSchedule ? today : null;

  const eligible = studyDays.flatMap(({ date, minutes }, index) => {
    const day = days[index];

    return day &&
      date >= toIsoDate(start) &&
      date !== shown &&
      !keptByDate.has(date) &&
      minutes >= MIN_BLOCK_MINUTES
      ? [{ date, minutes, today: day.date }]
      : [];
  });

  const testsMinutes = eligible.reduce(
    (total, { date }) => total + (tests.get(date)?.minutes ?? 0),
    0,
  );

  const room = eligible.reduce((total, day) => total + (tests.has(day.date) ? 0 : day.minutes), 0);
  const practiceMinutes = Math.min(...writing.practice.map(({ minutes }) => minutes));
  const budget = Math.max(practiceMinutes, practiceBudget - testsMinutes);
  const share = room > 0 ? Math.min(1, budget / room) : 0;

  const carry = getPlacementCarry(kept, writing.practice[0]?.taskKey);
  const state = { ...carry, accrued: 0, room, spent: 0 };

  const entries = eligible.flatMap((day): Entry[] => {
    const paper = tests.get(day.date);

    if (paper && state.remaining === 0) {
      return [
        {
          date: day.date,
          minutes: paper.minutes,
          tasks: paper.tasks,
          test: { day: paper.day, title: paper.title },
        },
      ];
    }

    state.accrued += day.minutes * share;

    const inCadence = isWrittenDay({
      cadence: input.settings.writtenCadence,
      date: day.today,
      planStart,
      targetDate,
    });

    const entry = takeWriting({ budget, day, inCadence, practice: writing.practice, state });

    state.room -= paper ? 0 : day.minutes;

    return entry ? [entry] : [];
  });

  return [...kept, ...entries].toSorted((a, b) => a.date.localeCompare(b.date));
}

export function allocateWriting({
  days,
  input,
  planStart,
  start,
  units,
}: {
  days: PlanDay[];
  input: BuildPlanInput;
  planStart: Date;
  start: Date;
  units: readonly QueueUnit[];
}) {
  const {
    writing,
    goal: { targetDate },
  } = input;

  if (!writing || writing.practice.length === 0) {
    return { days, schedule: undefined, teachingMinutes: 0, writingRequirement: undefined };
  }

  const total = days.reduce((sum, day) => sum + (day.date >= start ? day.shape.minutes : 0), 0);
  const written = total * getWrittenShare(input);

  const teaching = units
    .filter(({ skillId }) => skillId !== null && writing.skillIds.has(skillId))
    .reduce((sum, unit) => sum + unit.minutes + (unit.lessons ?? 1) * WRITING_DRILL_MINUTES, 0);

  const teachingMinutes = Math.min(written * MAX_TEACHING_SHARE, teaching);

  const schedule = listWritingSchedule({
    days,
    input,
    planStart,
    practiceBudget: written - teachingMinutes,
    start,
    targetDate,
    writing,
  });

  const byDate = new Map(schedule.map((entry) => [entry.date, entry]));

  const remaining = schedule.filter(({ date }) => date >= toIsoDate(start));
  const reserved = remaining.reduce((sum, entry) => sum + entry.minutes, 0);

  const target = getWritingTarget({
    budget: written - teachingMinutes,
    practice: writing.practice,
  });

  return {
    days: days.map((day) => {
      const entry = byDate.get(toIsoDate(day.date));

      return entry
        ? {
            ...day,
            shape: {
              ...day.shape,
              events: day.shape.events.filter(({ kind }) => kind !== "review"),
              writtenMinutes: entry.test ? day.shape.minutes : entry.minutes,
            },
          }
        : day;
    }),
    schedule,
    teachingMinutes,
    writingRequirement: { reserved, target },
  };
}

export function limitWrittenTeaching({
  held,
  minutes,
  units,
  writing,
}: {
  held: ReadonlySet<string>;
  minutes: number;
  units: readonly QueueUnit[];
  writing: PlanWriting | undefined;
}): { limited: QueueUnit[]; deferred: DroppedUnit[] } {
  const available: QueueUnit[] = [];
  const deferred: DroppedUnit[] = [];

  units.reduce((left, unit) => {
    if (!unit.skillId || !writing?.skillIds.has(unit.skillId) || unit.kind !== "lesson") {
      available.push(unit);
      return left;
    }

    const count = unit.lessons ?? 1;
    const cost = unit.minutes / count + WRITING_DRILL_MINUTES;
    const keep = held.has(unit.key) ? count : Math.min(count, Math.max(0, Math.floor(left / cost)));

    if (keep > 0) {
      available.push({
        ...unit,
        ...(unit.lessons && { lessons: keep }),
        minutes: cost * keep,
        teachingShare: unit.minutes / (count * cost),
      });
    }

    if (keep < count) {
      deferred.push({
        ...unit,
        fittedMinutes: 0,
        lessons: count - keep,
        minutes: (unit.minutes * (count - keep)) / count,
      });
    }

    return left - cost * keep;
  }, minutes);

  return { deferred, limited: available };
}

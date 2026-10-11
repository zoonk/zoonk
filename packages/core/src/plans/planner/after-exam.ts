import { type GoalKind } from "@zoonk/db";
import { type StudyCalendar, addDays, getWeeklyEventWeekday } from "./plan-calendar";
import { createLearnDays } from "./plan-days";
import { type PlanSettings } from "./plan-state";
import { type QueueUnit } from "./plan-units";
import {
  type DroppedUnit,
  type ScheduledEvent,
  type ScheduledUnit,
  listPlanDays,
  scheduleUnits,
} from "./schedule-units";

/** Ten years is past any real goal at any pace; what doesn't fit by then isn't planned. */
export const MAX_PLAN_DAYS = 3650;

/**
 * The days an exam plan that studies everything spans after the exam, and the minutes its work
 * there takes, the rest of the lessons a stand-in started before the exam included.
 */
export type AfterExamSpan = { end: Date; minutes: number; start: Date };

/**
 * What an exam plan that studies everything does after the exam (see `continueAfterExam`): its
 * units and events there, what doesn't fit even then, and the days its work after the exam spans,
 * the rest of the lessons a stand-in started before the exam included.
 */
export type AfterExam = {
  dropped: DroppedUnit[];
  events: ScheduledEvent[];
  span: AfterExamSpan | null;
  units: ScheduledUnit[];
};

/** Whether the plan goes on after its exam: an exam with a date that studies everything. */
function goesOnAfterExam({
  goal,
  settings,
}: {
  goal: { kind: GoalKind; targetDate: Date | null };
  settings: Pick<PlanSettings, "fullCourse">;
}): boolean {
  return goal.kind === "exam" && goal.targetDate !== null && settings.fullCourse;
}

/** A unit as it goes after the exam: no study-cycle day it opens or waits for. */
function toPlainUnit(unit: DroppedUnit): QueueUnit {
  const { fittedMinutes: _fitted, opensDay: _opens, startsAt: _starts, ...plain } = unit;
  return plain;
}

/**
 * The exam plan's lessons that don't fit before its final stretch, studied after the exam: from
 * the day after it (or today, once it's past), at the learner's time, in the order the plan cut
 * them (the topics it left out first, then depth; see `scheduleCoresFirst`), with the weekly mock
 * from the second week, as before the exam, for the next sitting. They form one more phase,
 * `phase`, after the exam's. Until the exam the plan stays the one its date shapes. Null for any
 * plan that doesn't go on after its exam. A stand-in
 * started before the exam stays one item there (an item per stand-in): the rest of its lessons
 * take their days after the exam, which the phase and the plan's end count, and become items of
 * their own once the Library outlines them.
 */
export function continueAfterExam({
  before,
  calendar,
  dropped,
  goal,
  mockMinutes,
  phase,
  settings,
  start,
}: {
  /** What the plan scheduled before the exam. */
  before: readonly Pick<QueueUnit, "key">[];
  calendar: StudyCalendar;
  /** What the plan couldn't fit before its final stretch, in the order it cut it. */
  dropped: readonly DroppedUnit[];
  goal: { kind: GoalKind; targetDate: Date | null };
  /** The exam's weekly mock, which goes on after it. */
  mockMinutes: number;
  phase: number;
  settings: Pick<PlanSettings, "fullCourse" | "practiceBias">;
  /** The first day this run schedules new work on. */
  start: Date;
}): AfterExam | null {
  const { targetDate } = goal;

  if (!targetDate || !goesOnAfterExam({ goal, settings })) {
    return null;
  }

  const dayAfter = addDays(targetDate, 1);
  const firstDay = start > dayAfter ? start : dayAfter;

  const learnDay = createLearnDays({
    calendar,
    eventWeekday: getWeeklyEventWeekday(calendar),
    mockMinutes,
    practiceBias: settings.practiceBias,
    start: firstDay,
    targetDate: null,
  });

  const days = listPlanDays({
    describeDay: (date) => ({ ...learnDay(date), phase }),
    horizonDays: MAX_PLAN_DAYS,
    start: firstDay,
  });

  const started = new Set(before.map((unit) => unit.key));

  const schedule = scheduleUnits({
    days,
    units: dropped.filter((unit) => unit.kind === "lesson").map((unit) => toPlainUnit(unit)),
  });

  const first = schedule.units[0]?.date;
  const last = schedule.units.at(-1)?.date;
  const events = schedule.events.filter((event) => last !== undefined && event.date <= last);

  const minutes = [
    ...schedule.units.map((unit) => unit.studyMinutes),
    ...events.map((event) => event.minutes),
  ].reduce((sum, value) => sum + value, 0);

  return {
    dropped: schedule.dropped,
    events,
    span: first && last ? { end: last, minutes, start: first } : null,
    units: schedule.units.filter((unit) => !started.has(unit.key)),
  };
}

import { type GoalKind } from "@zoonk/db";
import { MAX_PLAN_DAYS } from "../target-date-range";
import { type ExamBossDays, listBossEvents } from "./exam-boss-days";
import { type FundedMocks, type MockFunding, fundMocks } from "./mock-funding";
import { type MockClock, type MockResolution } from "./mock-identity";
import { type StudyCalendar, addDays, getWeeklyEventWeekday } from "./plan-calendar";
import { createLearnDays } from "./plan-days";
import { type PlanSettings } from "./plan-state";
import { type QueueUnit } from "./plan-units";
import {
  type DroppedUnit,
  type PlanDay,
  type ScheduledEvent,
  type ScheduledUnit,
  listPlanDays,
  scheduleUnits,
} from "./schedule-units";
import { type SkillMinutes } from "./skill-minutes";

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
  /**
   * The mocks its days fund after the exam, as the ones before it (see `fundMocks`), with what they
   * settle; the plan keeps those its lessons reach.
   */
  funded: FundedMocks;
  span: AfterExamSpan | null;
  units: ScheduledUnit[];
};

/**
 * Whether a plan's end (`end`) comes after its exam (`targetDate`): a plan studying everything
 * whose time fits it all before the exam ends with the exam, with no finish after it to say.
 */
export function endsAfterExam({
  end,
  targetDate,
}: {
  end: string | null;
  targetDate: string | null;
}): boolean {
  return end !== null && targetDate !== null && end > targetDate;
}

/**
 * When a plan studying everything ends (`end`), once it goes on after the exam (`targetDate`, see
 * `endsAfterExam`) and holds all of it, every skill's lessons whole (`skillMinutes`, which counts a
 * kept stand-in's cut too): its time after the exam stops at the plan's horizon (`MAX_PLAN_DAYS`),
 * so at a few minutes a day its last day can be years away with lessons still left out, which no
 * end date would be true of.
 */
export function getFullCourseEnd({
  built,
  end,
  targetDate,
}: {
  built: { skillMinutes: readonly SkillMinutes[] };
  end: string | null;
  targetDate: string | null;
}): string | null {
  const holdsAll = built.skillMinutes.every((skill) => skill.covered >= skill.total);
  return holdsAll && endsAfterExam({ end, targetDate }) ? end : null;
}

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
  bossDays,
  bossMinutes = () => 0,
  calendar,
  clocks,
  cursor,
  dropped,
  goal,
  mockMinutes,
  phase,
  resolution = null,
  saved,
  settings,
  start,
}: {
  /** Each exam day's mock clock (see `MockClock`). */
  clocks?: readonly MockClock[];
  /** The exam day of the plan's mock before these days (see `fundMocks`). */
  cursor?: number | null;
  /** What earlier passes settled about the run's mocks (see `resolvePlannedMocks`). */
  resolution?: MockResolution | null;
  /** The saved mocks no mock before the exam continued (see `matchSavedMocks`). */
  saved: readonly MockFunding[];
  /**
   * Where the run's phase challenges go (see `placeExamBosses`): one whose own teaching ends after
   * the exam goes on the day after it here, its phase's still.
   */
  bossDays?: ExamBossDays;
  /** A phase's challenge's minutes (see `getPlannedBossMinutes`). */
  bossMinutes?: (phase: number) => number;
  calendar: StudyCalendar;
  /** What the plan couldn't fit before its final stretch, in the order it cut it. */
  dropped: readonly DroppedUnit[];
  goal: { kind: GoalKind; targetDate: Date | null };
  /** The exam's weekly mock, which goes on after it. */
  mockMinutes: number;
  phase: number;
  settings: Pick<PlanSettings, "fullCourse" | "movedEvents" | "practiceBias">;
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

  const describeDay = (date: Date) => {
    const day = learnDay(date);
    const bosses = bossDays ? listBossEvents({ bossDays, bossMinutes, date }) : [];
    return { ...day, events: [...day.events, ...bosses], phase };
  };

  // The weekly mocks after the exam take their time from the days before them too (see `fundMocks`).
  const funded = fundMocks({
    clocks,
    cursor,
    days: listPlanDays({ describeDay, horizonDays: MAX_PLAN_DAYS, start: firstDay }),
    funding: saved,
    moves: settings.movedEvents,
    resolution,
  });

  const { days } = funded;

  const schedule = scheduleUnits({
    days,
    units: dropped.filter((unit) => unit.kind === "lesson").map((unit) => toPlainUnit(unit)),
  });

  // A phase's challenge stays whatever the lessons here: it closes teaching before it.
  const lastUnit = schedule.units.at(-1)?.date;

  const events = schedule.events.filter(
    (event) => event.kind === "boss" || (lastUnit !== undefined && event.date <= lastUnit),
  );

  const dates = [...schedule.units, ...events]
    .map((item) => item.date)
    .toSorted((a, b) => a.getTime() - b.getTime());

  const first = dates[0];
  const last = dates.at(-1);

  const minutes = [
    ...schedule.units.map((unit) => unit.studyMinutes),
    ...events.map((event) => event.minutes),
  ].reduce((sum, value) => sum + value, 0);

  return {
    dropped: schedule.dropped,
    events,
    funded,
    span: first && last ? { end: last, minutes, start: first } : null,
    units: schedule.units,
  };
}

/**
 * The days after the exam a phase's challenge can go on (see `listPhaseChallengeDays`): the plan's
 * days there up to its last work, and the first one after it with study time, where a challenge
 * whose teaching ends on that last day goes.
 */
export function listAfterExamDays(afterExam: AfterExam | null): PlanDay[] {
  const end = afterExam?.span?.end;

  if (!afterExam || !end) {
    return [];
  }

  const { days } = afterExam.funded;
  const next = days.findIndex((day) => day.date > end && day.shape.minutes > 0);
  return days.slice(0, next === -1 ? days.length : next + 1);
}

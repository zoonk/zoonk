import { type GoalKind } from "@zoonk/db";
import { MAX_PLAN_DAYS } from "../target-date-range";
import { type ExamBossDays, listBossEvents, withBossEvents } from "./exam-boss-days";
import { type FundedMocks, type MockFunding, fundMocks } from "./mock-funding";
import { type MockClock, type MockResolution } from "./mock-identity";
import { withMockSchedule } from "./moved-events";
import { type StudyCalendar, addDays, getWeeklyEventWeekday, toIsoDate } from "./plan-calendar";
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
import { type SkillMinutes, hasCompleteSkillCoverage } from "./skill-minutes";

export type AfterExamSpan = { end: Date; minutes: number; start: Date };

export type AfterExam = {
  dropped: DroppedUnit[];
  events: ScheduledEvent[];
  funded: FundedMocks;
  span: AfterExamSpan | null;
  units: ScheduledUnit[];
};

function endsAfterExam({
  end,
  targetDate,
}: {
  end: string | null;
  targetDate: string | null;
}): boolean {
  return end !== null && targetDate !== null && end > targetDate;
}

export function getFullCourseEnd({
  built,
  end,
  targetDate,
}: {
  built: { skillMinutes: readonly SkillMinutes[] };
  end: string | null;
  targetDate: string | null;
}): string | null {
  const holdsAll = hasCompleteSkillCoverage(built.skillMinutes);
  return holdsAll && endsAfterExam({ end, targetDate }) ? end : null;
}

function goesOnAfterExam({
  goal,
  settings,
}: {
  goal: { kind: GoalKind; targetDate: Date | null };
  settings: Pick<PlanSettings, "fullCourse">;
}): boolean {
  return goal.kind === "exam" && goal.targetDate !== null && settings.fullCourse;
}

function toPlainUnit(unit: DroppedUnit): QueueUnit {
  const { fittedMinutes: _fitted, opensDay: _opens, startsAt: _starts, ...plain } = unit;
  return plain;
}

/** Holds the day the learner opened when it falls on these days; the rest is scheduled around it. */
type HoldOpened = (laid: {
  days: readonly PlanDay[];
  units: readonly QueueUnit[];
}) => { days: readonly PlanDay[]; held: ScheduledUnit[]; units: readonly QueueUnit[] } | null;

export function continueAfterExam({
  bossDays,
  bossMinutes = () => 0,
  calendar,
  clocks,
  cursor,
  dropped,
  goal,
  holdOpened,
  mockMinutes,
  phase,
  resolution = null,
  saved,
  settings,
  start,
  planStart,
}: {
  clocks?: readonly MockClock[];
  cursor?: number | null;
  resolution?: MockResolution | null;
  saved: readonly MockFunding[];
  bossDays?: ExamBossDays;
  bossMinutes?: (phase: number) => number;
  calendar: StudyCalendar;
  dropped: readonly DroppedUnit[];
  goal: { kind: GoalKind; targetDate: Date | null };
  holdOpened?: HoldOpened;
  mockMinutes: number;
  phase: number;
  planStart: Date;
  settings: Pick<PlanSettings, "fullCourse" | "mockSchedule" | "movedEvents" | "practiceBias">;
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
    planStart,
    practiceBias: settings.practiceBias,
    start: firstDay,
    targetDate: null,
  });

  const describeDay = withMockSchedule((date) => {
    const day = learnDay(date);
    const bosses = bossDays ? listBossEvents({ bossDays, bossMinutes, date }) : [];
    return { ...day, events: withBossEvents({ bosses, events: day.events }), phase };
  }, settings.mockSchedule);

  const funded = fundMocks({
    clocks,
    cursor,
    days: listPlanDays({ describeDay, horizonDays: MAX_PLAN_DAYS, start: firstDay }),
    funding: saved,
    moves: settings.movedEvents,
    resolution,
  });

  const lessons = dropped.filter((unit) => unit.kind === "lesson").map((unit) => toPlainUnit(unit));
  const shown = holdOpened?.({ days: funded.days, units: lessons });

  const schedule = scheduleUnits({
    days: shown?.days ?? funded.days,
    units: shown?.units ?? lessons,
  });

  const units = [...(shown?.held ?? []), ...schedule.units];
  const lastUnit = units.at(-1)?.date;

  const movedDates = new Set(settings.mockSchedule?.map((entry) => entry.to));

  const events = schedule.events.filter(
    (event) =>
      event.kind === "boss" ||
      (event.kind === "mock" && movedDates.has(toIsoDate(event.date))) ||
      (lastUnit !== undefined && event.date <= lastUnit),
  );

  const dates = [...units, ...events]
    .map((item) => item.date)
    .toSorted((a, b) => a.getTime() - b.getTime());

  const first = dates[0];
  const last = dates.at(-1);

  const minutes = [
    ...units.map((unit) => unit.studyMinutes),
    ...events.map((event) => event.minutes),
  ].reduce((sum, value) => sum + value, 0);

  return {
    dropped: schedule.dropped,
    events,
    funded,
    span: first && last ? { end: last, minutes, start: first } : null,
    units,
  };
}

export function listAfterExamDays(afterExam: AfterExam | null): PlanDay[] {
  const end = afterExam?.span?.end;

  if (!afterExam || !end) {
    return [];
  }

  const { days } = afterExam.funded;
  const next = days.findIndex((day) => day.date > end && day.shape.minutes > 0);
  return days.slice(0, next === -1 ? days.length : next + 1);
}

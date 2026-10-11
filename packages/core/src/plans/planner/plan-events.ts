import { type BuildPlanInput } from "./build-plan";
import { getMockWeeks } from "./mock-days";
import { type ExistingPlanItem } from "./plan-items";
import { addPracticeDays } from "./practice-days";
import { type PlanDay, type ScheduledEvent, type ScheduledUnit } from "./schedule-units";
import { isShortExam } from "./short-exam-plan";
import { addSpareMocks } from "./spare-mocks";

/**
 * The plan's last lesson day: what this run scheduled (`units`), what this week keeps, and where a
 * stand-in this week began ends past its day (`keptUntil`, see `layOutAfterThisWeek`). The run's
 * copies of this week's other work don't count: a career's last lessons, kept on Sunday, ended on
 * Monday in them, and the refresh took Monday's practice day out of the plan.
 */
export function getLastLessonDate({
  kept,
  keptUntil,
  units,
}: {
  kept: readonly ExistingPlanItem[];
  keptUntil: Date | null;
  units: readonly ScheduledUnit[];
}): Date | null {
  const dates = [
    ...units.flatMap((unit) => (unit.kind === "lesson" ? [unit.date.getTime()] : [])),
    ...kept.flatMap((item) =>
      item.kind === "lesson" && item.scheduledFor ? [item.scheduledFor.getTime()] : [],
    ),
    ...(keptUntil ? [keptUntil.getTime()] : []),
  ];

  return dates.length > 0 ? new Date(Math.max(...dates)) : null;
}

/**
 * The plan's dated events: with a date, every one until then and practice days after the last
 * lesson (see `addPracticeDays`), and for an exam a mock more for each spare week (see
 * `addSpareMocks`); without a date, only those up to the last lesson.
 */
export function getPlanEvents({
  days,
  events,
  input,
  lastLessonDate,
  lastUnitDate,
  planStart,
}: {
  days: readonly PlanDay[];
  events: readonly ScheduledEvent[];
  input: BuildPlanInput;
  lastLessonDate: Date | null;
  /** The last thing the run scheduled, a phase checkpoint included. */
  lastUnitDate: Date | null;
  planStart: Date;
}): ScheduledEvent[] {
  const { targetDate } = input.goal;

  if (!targetDate) {
    return events.filter((event) => lastUnitDate && event.date <= lastUnitDate);
  }

  if (input.goal.kind === "exam" && isShortExam({ planStart, targetDate })) {
    return [...events];
  }

  const practice = addPracticeDays({ days, events, lastLessonDate });
  const mockMinutes = input.fullMockMinutes ?? input.mockMinutes;

  return input.goal.kind === "exam"
    ? addSpareMocks({
        days,
        events: practice,
        lastLessonDate,
        mockMinutes,
        moves: input.settings.movedEvents,
        targetDate,
        weeks: getMockWeeks({
          calendar: {
            dailyMinutes: input.goal.dailyMinutes,
            weekdayMinutes: input.settings.weekdayMinutes,
          },
          minutes: mockMinutes,
        }),
      })
    : practice;
}

import { type BuildPlanInput } from "./build-plan";
import { type ExistingPlanItem } from "./plan-items";
import { addPracticeDays } from "./practice-days";
import { type PlanDay, type ScheduledEvent, type ScheduledUnit } from "./schedule-units";
import { isShortExam } from "./short-exam-plan";
import { addSpareMocks } from "./spare-mocks";

/** The plan's last lesson day: what this run scheduled, or what this week keeps. */
export function getLastLessonDate({
  kept,
  units,
}: {
  kept: readonly ExistingPlanItem[];
  units: readonly ScheduledUnit[];
}): Date | null {
  const dates = [
    ...units.filter((unit) => unit.kind === "lesson").map((unit) => unit.date.getTime()),
    ...kept.flatMap((item) =>
      item.kind === "lesson" && item.scheduledFor ? [item.scheduledFor.getTime()] : [],
    ),
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

  return input.goal.kind === "exam"
    ? addSpareMocks({
        days,
        events: practice,
        lastLessonDate,
        mockMinutes: input.mockMinutes,
        moves: input.settings.movedEvents,
        targetDate,
      })
    : practice;
}

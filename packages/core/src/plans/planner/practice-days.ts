import { toIsoDate } from "./plan-calendar";
import { type PlanDay, type ScheduledEvent } from "./schedule-units";

/** A day lessons could use that comes after the plan's last lesson. */
export function isSpareDay({
  day,
  lastLessonDate,
}: {
  day: PlanDay;
  /** The plan's last lesson; null when none is left. */
  lastLessonDate: Date | null;
}): boolean {
  const { minutes, open } = day.shape;
  return open && minutes > 0 && (lastLessonDate === null || day.date > lastLessonDate);
}

/**
 * The days a plan with a date has after its last lesson, before its deadline, as practice days:
 * what gets a learner closest to the goal once everything is learned is retrieving it, spaced, on
 * the weakest skills first and at the exam's level and above, with the week's checkpoint or mock
 * in real conditions, not days with nothing in them. Sessions build these days as reviews and
 * mixed practice (a plan's `review` days), harder once nothing new is left. Days that already hold
 * something (a checkpoint, a mock, the final stretch's own reviews) keep it.
 */
export function addPracticeDays({
  days,
  events,
  lastLessonDate,
}: {
  days: readonly PlanDay[];
  events: readonly ScheduledEvent[];
  /** The plan's last lesson; null when none is left, so every open day practices. */
  lastLessonDate: Date | null;
}): ScheduledEvent[] {
  const taken = new Set(events.map((event) => event.date.getTime()));

  const practice = days.flatMap((day): ScheduledEvent[] => {
    const { minutes, phase } = day.shape;

    if (!isSpareDay({ day, lastLessonDate }) || taken.has(day.date.getTime())) {
      return [];
    }

    return [
      {
        date: day.date,
        key: `review:${toIsoDate(day.date)}`,
        kind: "review",
        minutes,
        phase,
        replacesDay: false,
        title: "",
      },
    ];
  });

  return [...events, ...practice].toSorted((a, b) => a.date.getTime() - b.date.getTime());
}

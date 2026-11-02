import { toIsoDate } from "./plan-calendar";
import { type PlanDay, type ScheduledEvent, type ScheduledUnit } from "./schedule-units";

export function isSpareDay({
  day,
  lastLessonDate,
}: {
  day: PlanDay;
  lastLessonDate: Date | null;
}): boolean {
  const { minutes, open } = day.shape;
  return open && minutes > 0 && (lastLessonDate === null || day.date > lastLessonDate);
}

export function addPracticeDays({
  days,
  events,
  lastLessonDate,
  units = [],
}: {
  days: readonly PlanDay[];
  events: readonly ScheduledEvent[];
  lastLessonDate: Date | null;
  units?: readonly ScheduledUnit[];
}): ScheduledEvent[] {
  const taken = new Set(events.map((event) => event.date.getTime()));

  const used = units.reduce(
    (sums, unit) =>
      sums.set(unit.date.getTime(), (sums.get(unit.date.getTime()) ?? 0) + unit.studyMinutes),
    new Map<number, number>(),
  );

  const practice = days.flatMap((day): ScheduledEvent[] => {
    const { phase } = day.shape;
    const minutes = day.shape.minutes - (used.get(day.date.getTime()) ?? 0);

    if (!isSpareDay({ day, lastLessonDate }) || taken.has(day.date.getTime()) || minutes <= 0) {
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

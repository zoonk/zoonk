import { MS_PER_DAY } from "@zoonk/utils/date";

/**
 * What a missed day does to the phase it falls in, against a goal's fixed date: the phase ends a
 * day later, unless that would pass the date (an exam the next day), when it keeps its end and one
 * of its lessons is left out instead.
 */
export function getMissedDayChange({ date, end }: { date: Date; end: Date }) {
  const movedEnd = new Date(end.getTime() + MS_PER_DAY);

  return movedEnd > date ? { kind: "leftOut" as const } : { kind: "moved" as const, movedEnd };
}

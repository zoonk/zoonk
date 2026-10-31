import { MS_PER_DAY } from "@zoonk/utils/date";

export function getMissedDayChange({ date, end }: { date: Date; end: Date }) {
  const movedEnd = new Date(end.getTime() + MS_PER_DAY);

  return movedEnd > date ? { kind: "leftOut" as const } : { kind: "moved" as const, movedEnd };
}

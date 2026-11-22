/** A lesson or an unwritten lesson's time on the day, at its place in the plan. */
export type PlannedTime = { minutes: number; position: number };

type Hold<Unwritten> = { held: number; reached: boolean; unwritten: Unwritten };

/**
 * The plan teaches in order, so the lessons before an unwritten one take the day's room first and
 * it holds only the minutes they leave. Once a lesson no longer fits, nothing after it is reached.
 * Returns, for each unwritten lesson, whether the day reaches it and the minutes it holds.
 */
export function holdUnwrittenTime<Unwritten extends PlannedTime>({
  lessons,
  room,
  unwritten,
}: {
  lessons: readonly PlannedTime[];
  room: number;
  unwritten: readonly Unwritten[];
}): Hold<Unwritten>[] {
  const steps = [
    ...lessons.map((lesson) => ({ ...lesson, entry: null })),
    ...unwritten.map((entry) => ({ entry, minutes: entry.minutes, position: entry.position })),
  ].toSorted(
    (a, b) => a.position - b.position || Number(a.entry !== null) - Number(b.entry !== null),
  );

  const holds: Hold<Unwritten>[] = [];
  let left = Math.max(0, room);

  for (const { entry, minutes } of steps) {
    if (entry === null) {
      left = minutes <= left ? left - minutes : 0;
    } else {
      const held = Math.min(minutes, left);
      holds.push({ held, reached: left > 0, unwritten: entry });
      left -= held;
    }
  }

  return holds;
}

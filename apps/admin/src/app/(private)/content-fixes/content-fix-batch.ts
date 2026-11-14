/**
 * The reason most fixes of a batch share; a fix that gave its own shows it beside its changes. Null
 * when no two fixes share one: each gave its own, and the batch's own reason isn't stored.
 */
export function sharedReason(fixes: readonly { reason: string }[]): string | null {
  const counts = Map.groupBy(fixes, (fix) => fix.reason);
  const [top] = [...counts.entries()].toSorted(([, left], [, right]) => right.length - left.length);

  return top && (top[1].length > 1 || fixes.length === 1) ? top[0] : null;
}

/** The start of the place every fix is in: "Academic Reading › Words in short passages". */
export function sharedPlace(trails: readonly (readonly string[])[]): string[] {
  const [first = [], ...rest] = trails;
  const length = first.findIndex((part, index) => rest.some((trail) => trail[index] !== part));

  return first.slice(0, length === -1 ? first.length : length);
}

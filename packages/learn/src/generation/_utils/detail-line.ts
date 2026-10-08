/** Numbered lines for a phase that makes several things: "Writing screen 2…". */
export type NumberedLines = {
  /** How many it usually makes, so the numbers never run past what's real. */
  count: number;
  line: (number: number) => string;
  /** Said after every two numbered lines. */
  review: string;
};

const REVIEW_EVERY = 2;

function toNumberedLines({ count, line, review }: NumberedLines): string[] {
  return Array.from({ length: count }, (_, index) => index + 1).flatMap((number) =>
    number % REVIEW_EVERY === 0 && number < count ? [line(number), review] : [line(number)],
  );
}

/**
 * The detail line a running phase shows at its `tick`: its lines in order, then its numbered
 * lines, then its unnumbered lines again for as long as it keeps running.
 */
export function getDetailLine({
  lines,
  numbered,
  tick,
}: {
  lines: readonly string[];
  numbered?: NumberedLines;
  tick: number;
}): string | null {
  const sequence = [...lines, ...(numbered ? toNumberedLines(numbered) : [])];

  if (tick < sequence.length) {
    return sequence[tick] ?? null;
  }

  const loop = numbered ? [...lines, numbered.review] : lines;
  return loop.length === 0 ? null : (loop[(tick - sequence.length) % loop.length] ?? null);
}

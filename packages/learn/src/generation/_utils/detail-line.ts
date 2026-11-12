export type NumberedLines = { count: number; line: (number: number) => string; review: string };

const REVIEW_EVERY = 2;

function toNumberedLines({ count, line, review }: NumberedLines): string[] {
  return Array.from({ length: count }, (_, index) => index + 1).flatMap((number) =>
    number % REVIEW_EVERY === 0 && number < count ? [line(number), review] : [line(number)],
  );
}

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

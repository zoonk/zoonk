const TARGET_STEPS = 4;
// oxlint-disable-next-line eslint/no-magic-numbers -- The 1, 2, 5 series of round axis steps.
const NICE_STEPS = [1, 2, 5, 10];

/**
 * Evenly spaced ticks from 0 that reach the largest value: steps of 1, 2 or 5 times a power of ten.
 * Recharts' own ticks end on the largest value itself, which leaves one short step at the top.
 */
export function getEvenTicks(maximumValue: number): number[] {
  const rough = Math.max(maximumValue, 1) / TARGET_STEPS;
  const magnitude = 10 ** Math.floor(Math.log10(rough));

  const step = Math.max(
    1,
    (NICE_STEPS.find((nice) => nice * magnitude >= rough) ?? 10) * magnitude,
  );

  const count = Math.max(1, Math.ceil(maximumValue / step));

  return Array.from({ length: count + 1 }, (_, index) => index * step);
}

/** The smallest text size (`text-2xs`), which an SVG label can't take from a class. */
export const CHART_TICK_FONT_SIZE = 11.5;

/**
 * A value axis's label, ending on one edge like a column of numbers. Its axis takes `width="auto"`,
 * so the widest label starts on the chart's left edge, in line with the text above and below it.
 */
export function ChartValueTick({
  format,
  payload,
  x,
  y,
}: {
  format: (value: number) => string;
  payload?: { value: number };
  x?: number;
  y?: number;
}) {
  if (!payload || x === undefined || y === undefined) {
    return null;
  }

  return (
    <text
      dy="0.32em"
      fill="var(--muted-foreground)"
      fontFamily="var(--font-mono)"
      fontSize={CHART_TICK_FONT_SIZE}
      textAnchor="end"
      x={x}
      y={y}
    >
      {format(payload.value)}
    </text>
  );
}

/** The plot reaches both edges of the chart; this keeps the first and last bars off them. */
export const CHART_CATEGORY_PADDING = { left: 8, right: 8 };

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

/**
 * A value axis's label, starting on the chart's left edge so it lines up with the text above and
 * below the chart. Recharts ends its labels on the plot instead, which indents them by their width.
 */
export function ChartValueTick({
  format,
  payload,
  y,
}: {
  format: (value: number) => string;
  payload?: { value: number };
  y?: number;
}) {
  if (!payload || y === undefined) {
    return null;
  }

  return (
    <text dy="0.32em" fill="var(--muted-foreground)" fontSize={11} textAnchor="start" x={0} y={y}>
      {format(payload.value)}
    </text>
  );
}

/** The plot reaches both edges of the chart; this keeps the first and last bars off them. */
export const CHART_CATEGORY_PADDING = { left: 8, right: 8 };

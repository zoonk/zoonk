import { cn } from "@zoonk/ui/lib/utils";
import { isValidChartPayload } from "@zoonk/utils/chart";
import { type CSSProperties, type ComponentProps, type ReactNode } from "react";
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { PROGRESS_CHART_HEIGHT } from "./progress-chart-figure";

type ProgressLineChartProps = Omit<
  ComponentProps<typeof LineChart>,
  "margin" | "responsive" | "style"
>;

type ProgressChartTooltipProps<DataPoint> = { children: (data: DataPoint) => ReactNode };

type ProgressChartLineProps = { color: string; dataKey: string };

const PROGRESS_CHART_MARGIN = { bottom: 0, left: 0, right: 0, top: 8 };

const PROGRESS_CHART_STYLE = {
  height: PROGRESS_CHART_HEIGHT,
  width: "100%",
} satisfies CSSProperties;

/** Tick labels are numbers and dates, so they read in the mono face, small and muted. */
const PROGRESS_CHART_TICK_PROPS = {
  fill: "var(--muted-foreground)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
} as const;

/**
 * Room at each end of the time axis, so the first and last dates sit whole inside the chart
 * instead of half outside it.
 */
const X_AXIS_PADDING = { left: 16, right: 24 };

/** A guide every quarter of the 0–100 scale. */
const PERCENT_GUIDES = 4;
const PERCENT = 100;

const PERCENT_TICKS = Array.from(
  { length: PERCENT_GUIDES + 1 },
  (_, guide) => (guide * PERCENT) / PERCENT_GUIDES,
);

/** The dots' radii: a small one on each value, a larger one on the value under the pointer. */
// oxlint-disable-next-line eslint/id-length -- `r` is SVG's name for a circle's radius.
const DOT = { fill: "currentColor", r: 2.5, strokeWidth: 0 };
// oxlint-disable-next-line eslint/id-length -- `r` is SVG's name for a circle's radius.
const ACTIVE_DOT = { r: 4, stroke: "var(--card)", strokeWidth: 2 };

/**
 * Keeps every progress chart on the same Recharts sizing path. Recharts' ResponsiveContainer warns
 * during the first render because it starts with a temporary -1 by -1 measurement. The chart-level
 * `responsive` prop uses normal CSS sizing instead, so each chart gets a stable height before the
 * browser measures its width.
 */
export function ProgressLineChart(props: ProgressLineChartProps) {
  return (
    <LineChart {...props} margin={PROGRESS_CHART_MARGIN} responsive style={PROGRESS_CHART_STYLE} />
  );
}

/**
 * Solid hairlines in the border color, quieter than the data. The vertical grid stays hidden
 * because these charts compare trends across time and the horizontal guides are enough.
 */
export function ProgressChartGrid() {
  return <CartesianGrid stroke="var(--border)" vertical={false} />;
}

/**
 * The time axis: every chart's data carries a learner-facing `label`. The first and last labels
 * always show, whole, and the ones between give way when they'd crowd.
 */
export function ProgressChartXAxis() {
  return (
    <XAxis
      axisLine={false}
      dataKey="label"
      interval="preserveStartEnd"
      minTickGap={24}
      padding={X_AXIS_PADDING}
      tick={PROGRESS_CHART_TICK_PROPS}
      tickLine={false}
      tickMargin={8}
    />
  );
}

/** Percent metrics share one 0–100 scale with a guide every 25 points. */
export function ProgressChartPercentYAxis() {
  return (
    <YAxis
      axisLine={false}
      domain={[0, 100]}
      tick={PROGRESS_CHART_TICK_PROPS}
      tickLine={false}
      tickMargin={8}
      ticks={PERCENT_TICKS}
      width={36}
    />
  );
}

/**
 * The metric as a line alone, no area under it: its color, a small dot on each value, the active
 * one ringed in the card's color so it reads in both themes. It's drawn in place, without an
 * entrance animation.
 */
export function ProgressChartLine({ color, dataKey }: ProgressChartLineProps) {
  return (
    <Line
      activeDot={ACTIVE_DOT}
      dataKey={dataKey}
      dot={{ ...DOT, fill: color }}
      isAnimationActive={false}
      stroke={color}
      strokeWidth={2}
      type="monotone"
    />
  );
}

/**
 * Handles Recharts' tooltip payload guard once for all progress charts. The chart-specific
 * tooltip content still lives at the call site.
 */
export function ProgressChartTooltip<DataPoint>({
  children,
}: ProgressChartTooltipProps<DataPoint>) {
  return (
    <Tooltip
      content={({ active, payload }) => {
        if (!(active && isValidChartPayload<DataPoint>(payload))) {
          return null;
        }

        return children(payload[0].payload);
      }}
      cursor={{ stroke: "var(--border)" }}
      isAnimationActive={false}
    />
  );
}

/** The tooltip's panel, the same for every progress chart. */
export function ProgressChartTooltipContent({ children }: { children: ReactNode }) {
  return (
    <div className="bg-popover text-popover-foreground ring-border flex flex-col gap-0.5 rounded-md px-3 py-2 shadow-md ring-1">
      {children}
    </div>
  );
}

/** The tooltip's date, quieter than its value. */
export function ProgressChartTooltipLabel({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground font-mono text-xs">{children}</p>;
}

/** The tooltip's value in the mono face; each metric passes its own color class. */
export function ProgressChartTooltipValue({ children, className }: ComponentProps<"p">) {
  return <p className={cn("font-mono text-sm font-medium tabular-nums", className)}>{children}</p>;
}

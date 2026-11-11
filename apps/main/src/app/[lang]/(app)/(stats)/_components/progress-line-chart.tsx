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

const PROGRESS_CHART_TICK_PROPS = { fill: "var(--muted-foreground)", fontSize: 11 } as const;

const X_AXIS_PADDING = { left: 16, right: 24 };

const PERCENT_GUIDES = 4;
const PERCENT = 100;

const PERCENT_TICKS = Array.from(
  { length: PERCENT_GUIDES + 1 },
  (_, guide) => (guide * PERCENT) / PERCENT_GUIDES,
);

// oxlint-disable-next-line eslint/id-length -- `r` is SVG's name for a circle's radius.
const DOT = { fill: "currentColor", r: 2.5, strokeWidth: 0 };
// oxlint-disable-next-line eslint/id-length -- `r` is SVG's name for a circle's radius.
const ACTIVE_DOT = { r: 4, stroke: "var(--card)", strokeWidth: 2 };

/** Recharts' ResponsiveContainer warns on its first -1 by -1 measurement; the chart's `responsive` prop uses CSS sizing. */
export function ProgressLineChart(props: ProgressLineChartProps) {
  return (
    <LineChart {...props} margin={PROGRESS_CHART_MARGIN} responsive style={PROGRESS_CHART_STYLE} />
  );
}

export function ProgressChartGrid() {
  return <CartesianGrid stroke="var(--viz-grid)" vertical={false} />;
}

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

/** Drawn in place, without an entrance animation. */
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
      cursor={{ stroke: "var(--viz-grid)" }}
      isAnimationActive={false}
    />
  );
}

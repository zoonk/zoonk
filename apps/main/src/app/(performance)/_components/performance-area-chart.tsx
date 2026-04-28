import { cn } from "@zoonk/ui/lib/utils";
import { isValidChartPayload } from "@zoonk/utils/chart";
import { type CSSProperties, type ComponentProps, type ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";

type PerformanceAreaChartProps = Omit<
  ComponentProps<typeof AreaChart>,
  "margin" | "responsive" | "style"
>;

type PerformanceChartFigureProps = {
  children: ReactNode;
  label: string;
};

type PerformanceChartTooltipProps<DataPoint> = {
  children: (data: DataPoint) => ReactNode;
};

type PerformanceChartGradientProps = {
  color: string;
  id: string;
};

type PerformanceChartAreaProps = {
  color: string;
  dataKey: string;
  gradientId: string;
};

type PerformanceChartAverageLineProps = {
  children: string;
  y: number;
};

type PerformanceChartCompactYAxisProps = {
  locale: string;
};

const PERFORMANCE_CHART_MARGIN = { bottom: 0, left: 0, right: 0, top: 10 };

const PERFORMANCE_CHART_STYLE = {
  height: 256,
  width: "100%",
} satisfies CSSProperties;

/**
 * Gives each performance chart the same accessible container and flex-safe
 * width behavior. Recharts measures the chart from this parent, so every chart
 * should use the same `min-w-0` guard instead of relying on each page to
 * remember it.
 */
export function PerformanceChartFigure({ children, label }: PerformanceChartFigureProps) {
  return (
    <figure aria-label={label} className="w-full min-w-0">
      {children}
    </figure>
  );
}

/**
 * Keeps every performance AreaChart on the same Recharts sizing path.
 * Recharts' ResponsiveContainer warns during the first render because it starts
 * with a temporary -1 by -1 measurement. The chart-level `responsive` prop uses
 * normal CSS sizing instead, so each chart gets a stable height before the
 * browser measures its width.
 */
export function PerformanceAreaChart(props: PerformanceAreaChartProps) {
  return (
    <AreaChart
      {...props}
      margin={PERFORMANCE_CHART_MARGIN}
      responsive
      style={PERFORMANCE_CHART_STYLE}
    />
  );
}

/**
 * Keeps chart background grid styling consistent across every performance
 * metric. The vertical grid stays hidden because these charts compare trends
 * across time and the horizontal guides are enough for scanning values.
 */
export function PerformanceChartGrid() {
  return <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />;
}

/**
 * Keeps every performance chart on the same x-axis contract. All chart data is
 * serialized with a learner-facing `label`, so keeping that data key here
 * prevents one metric from drifting into a different tick style.
 */
export function PerformanceChartXAxis() {
  return (
    <XAxis
      axisLine={false}
      dataKey="label"
      fontSize={12}
      stroke="var(--muted-foreground)"
      tickLine={false}
      tickMargin={8}
    />
  );
}

/**
 * Keeps percent-based metrics on the same y-axis scale. Energy and score both
 * live on a 0-100 range, so the domain, width, and tick spacing should stay in
 * one shared component.
 */
export function PerformanceChartPercentYAxis() {
  return (
    <YAxis
      axisLine={false}
      domain={[0, 100]}
      fontSize={12}
      stroke="var(--muted-foreground)"
      tickLine={false}
      tickMargin={8}
      width={40}
    />
  );
}

/**
 * Keeps Brain Power on the same y-axis style while allowing locale-aware compact
 * numbers. BP can grow beyond a percent range, so it needs its own axis variant
 * but should still match the shared performance chart typography and chrome.
 */
export function PerformanceChartCompactYAxis({ locale }: PerformanceChartCompactYAxisProps) {
  return (
    <YAxis
      axisLine={false}
      fontSize={12}
      stroke="var(--muted-foreground)"
      tickFormatter={(value: number) =>
        new Intl.NumberFormat(locale, { notation: "compact" }).format(value)
      }
      tickLine={false}
      tickMargin={8}
      width={48}
    />
  );
}

/**
 * Keeps area fills visually consistent while leaving the metric color explicit.
 * Every performance chart uses the same fade shape, and the caller only decides
 * which CSS color token owns that metric.
 */
export function PerformanceChartGradient({ color, id }: PerformanceChartGradientProps) {
  return (
    <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
      <stop offset="5%" stopColor={color} stopOpacity={0.3} />
      <stop offset="95%" stopColor={color} stopOpacity={0} />
    </linearGradient>
  );
}

/**
 * Keeps area-series styling consistent while leaving the metric key and color
 * explicit. Without this wrapper, small differences like fill opacity or stroke
 * width can drift between charts that should feel like one family.
 */
export function PerformanceChartArea({ color, dataKey, gradientId }: PerformanceChartAreaProps) {
  return (
    <Area
      dataKey={dataKey}
      fill={`url(#${gradientId})`}
      fillOpacity={1}
      stroke={color}
      strokeWidth={2}
      type="monotone"
    />
  );
}

/**
 * Handles Recharts' tooltip payload guard once for all performance charts.
 * The chart-specific tooltip content still lives at the call site, but the
 * fragile active/payload validation no longer needs to be copied into every
 * metric chart.
 */
export function PerformanceChartTooltip<DataPoint>({
  children,
}: PerformanceChartTooltipProps<DataPoint>) {
  return (
    <Tooltip
      content={({ active, payload }) => {
        if (!(active && isValidChartPayload<DataPoint>(payload))) {
          return null;
        }

        return children(payload[0].payload);
      }}
    />
  );
}

/**
 * Keeps tooltip containers visually identical across performance charts. The
 * metric-specific rows are composed inside this shell so color and text can vary
 * without changing the shared border, background, or spacing.
 */
export function PerformanceChartTooltipContent({ children }: { children: ReactNode }) {
  return <div className="bg-background rounded-lg border px-3 py-2 shadow-sm">{children}</div>;
}

/**
 * Keeps tooltip date labels muted and compact across every performance chart.
 * These labels identify the active point, so they should stay quieter than the
 * metric value regardless of which metric is being shown.
 */
export function PerformanceChartTooltipLabel({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-xs">{children}</p>;
}

/**
 * Keeps tooltip metric values on the same type scale while letting each metric
 * pass its own color class. The color is the only intended visual difference
 * between the energy, score, and BP values.
 */
export function PerformanceChartTooltipValue({ children, className }: ComponentProps<"p">) {
  return <p className={cn("text-sm font-medium", className)}>{children}</p>;
}

/**
 * Keeps the average marker identical for percent-based performance charts.
 * Energy and score both show an average line, so the line style and label
 * placement should stay shared while the caller supplies the localized label.
 */
export function PerformanceChartAverageLine({ children, y }: PerformanceChartAverageLineProps) {
  return (
    <ReferenceLine
      label={{
        fill: "var(--muted-foreground)",
        fontSize: 11,
        position: "insideBottomRight",
        value: children,
      }}
      stroke="var(--muted-foreground)"
      strokeDasharray="3 3"
      y={y}
    />
  );
}

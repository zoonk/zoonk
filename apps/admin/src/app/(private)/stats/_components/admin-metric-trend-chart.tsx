"use client";

import {
  CHART_CATEGORY_PADDING,
  CHART_TICK_FONT_SIZE,
  ChartValueTick,
  getEvenTicks,
} from "@/components/chart-axis";
import { formatDuration } from "@/lib/format-duration";
import { isValidChartPayload } from "@zoonk/utils/chart";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { type MetricTrendDataPoint } from "../_utils/complete-metric-trend";

const BAR_OPACITY = 0.72;
const BAR_CORNER_RADIUS = 4;
const BAR_RADIUS: [number, number, number, number] = [BAR_CORNER_RADIUS, BAR_CORNER_RADIUS, 0, 0];
const MAX_BAR_SIZE = 40;
// oxlint-disable-next-line eslint/no-magic-numbers -- Quarters of a percent axis.
const PERCENT_TICKS = [0, 25, 50, 75, 100];
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;

export type MetricTrendValueFormat = "duration" | "number" | "percent";

function formatMetricTrendValue({
  format,
  value,
}: {
  format: MetricTrendValueFormat;
  value: number | null;
}): string {
  if (value === null) {
    return "No data";
  }

  if (format === "duration") {
    return formatDuration(value);
  }

  if (format === "percent") {
    return `${value.toFixed(1)}%`;
  }

  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatMetricTrendAxisValue({
  format,
  value,
}: {
  format: MetricTrendValueFormat;
  value: number;
}): string {
  if (format === "duration" && value < SECONDS_PER_MINUTE) {
    return `${Math.round(value)}s`;
  }

  if (format === "duration" && value < SECONDS_PER_HOUR) {
    return `${(value / SECONDS_PER_MINUTE).toLocaleString(undefined, { maximumFractionDigits: 1 })}m`;
  }

  if (format === "duration") {
    return `${(value / SECONDS_PER_HOUR).toLocaleString(undefined, { maximumFractionDigits: 1 })}h`;
  }

  if (format === "percent") {
    return `${Math.round(value)}%`;
  }

  return Math.round(value).toLocaleString();
}

/** Only real points: missing buckets never become zeroes for rates or averages. */
function getTrendExtremes(dataPoints: MetricTrendDataPoint[]) {
  const validPoints = dataPoints.filter(
    (dataPoint): dataPoint is MetricTrendDataPoint & { value: number } => dataPoint.value !== null,
  );

  if (validPoints.length === 0) {
    return;
  }

  return {
    low: validPoints.reduce((lowest, point) => (point.value < lowest.value ? point : lowest)),
    observedPointCount: validPoints.length,
    peak: validPoints.reduce((highest, point) => (point.value > highest.value ? point : highest)),
  };
}

function getFlatTrendLabel({
  hasCompleteTrend,
  observedPointCount,
}: {
  hasCompleteTrend: boolean;
  observedPointCount: number;
}): string {
  if (observedPointCount === 1) {
    return "Observed";
  }

  return hasCompleteTrend ? "Every bucket" : "Observed buckets";
}

/** Durations keep Recharts' own ticks, which are even when it also picks the axis's end. */
function getTrendTicks({
  maximumValue,
  valueFormat,
}: {
  maximumValue: number;
  valueFormat: MetricTrendValueFormat;
}): number[] | undefined {
  if (valueFormat === "percent") {
    return PERCENT_TICKS;
  }

  if (valueFormat === "number") {
    return getEvenTicks(maximumValue);
  }
}

function AdminMetricTrendTooltip({
  active,
  payload,
  valueFormat,
}: {
  active?: boolean;
  payload?: unknown;
  valueFormat: MetricTrendValueFormat;
}) {
  if (!active || !isValidChartPayload<MetricTrendDataPoint>(payload)) {
    return null;
  }

  const data = payload[0].payload;

  return (
    <div className="bg-background rounded-lg border px-3 py-2 shadow-sm">
      <p className="text-muted-foreground text-xs">{data.label}</p>
      <p className="text-sm font-medium tabular-nums">
        {formatMetricTrendValue({ format: valueFormat, value: data.value })}
      </p>
    </div>
  );
}

export function AdminMetricTrendChart({
  dataPoints,
  label,
  valueFormat,
}: {
  dataPoints: MetricTrendDataPoint[];
  label: string;
  valueFormat: MetricTrendValueFormat;
}) {
  const extremes = getTrendExtremes(dataPoints);

  if (!extremes) {
    return (
      <figure
        aria-label={`${label} trend`}
        className="text-muted-foreground flex min-h-80 flex-1 items-center justify-center text-sm"
      >
        No data in this period
      </figure>
    );
  }

  const isFlatTrend = extremes.low.value === extremes.peak.value;
  const hasCompleteTrend = dataPoints.every((dataPoint) => dataPoint.value !== null);
  const ticks = getTrendTicks({ maximumValue: extremes.peak.value, valueFormat });
  const hasNothingToDraw = extremes.peak.value === 0;

  return (
    <figure aria-label={`${label} trend`} className="flex min-h-0 flex-1 flex-col gap-5">
      <figcaption className="flex flex-wrap gap-x-10 gap-y-2 text-sm">
        {isFlatTrend ? (
          <TrendAnnotation
            format={valueFormat}
            label={getFlatTrendLabel({
              hasCompleteTrend,
              observedPointCount: extremes.observedPointCount,
            })}
            point={extremes.peak}
            showDate={false}
          />
        ) : (
          <>
            <TrendAnnotation format={valueFormat} label="Peak" point={extremes.peak} />
            <TrendAnnotation format={valueFormat} label="Low" point={extremes.low} />
          </>
        )}
      </figcaption>

      {/* Every value is 0: the line above says so, and bars of no height would be an empty frame. */}
      {hasNothingToDraw ? null : (
        <div className="h-88 w-full sm:h-120 lg:h-[min(54vh,34rem)]">
          <ResponsiveContainer height="100%" width="100%">
            <BarChart data={dataPoints} margin={{ bottom: 0, left: 0, right: 0, top: 12 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 6" vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="label"
                fontSize={CHART_TICK_FONT_SIZE}
                interval="equidistantPreserveStart"
                minTickGap={48}
                padding={CHART_CATEGORY_PADDING}
                stroke="var(--muted-foreground)"
                tickLine={false}
                tickMargin={10}
              />
              <YAxis
                allowDecimals={valueFormat !== "number"}
                axisLine={false}
                domain={ticks ? [0, ticks.at(-1) ?? 1] : undefined}
                tick={
                  <ChartValueTick
                    format={(value) => formatMetricTrendAxisValue({ format: valueFormat, value })}
                  />
                }
                tickLine={false}
                ticks={ticks}
                width="auto"
              />
              <Tooltip
                content={<AdminMetricTrendTooltip valueFormat={valueFormat} />}
                cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
              />

              <Bar
                dataKey="value"
                fill="var(--foreground)"
                isAnimationActive={false}
                maxBarSize={MAX_BAR_SIZE}
                opacity={BAR_OPACITY}
                radius={BAR_RADIUS}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  );
}

function TrendAnnotation({
  format,
  label,
  point,
  showDate = true,
}: {
  format: MetricTrendValueFormat;
  label: string;
  point: MetricTrendDataPoint & { value: number };
  showDate?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">
        {formatMetricTrendValue({ format, value: point.value })}
      </span>
      {showDate ? <span className="text-muted-foreground">{point.label}</span> : null}
    </div>
  );
}

"use client";

import { type ChartValueFormat, formatChartTick, formatChartValue } from "@/lib/chart-format";
import {
  ChartTooltipContent,
  ChartTooltipLabel,
  ChartTooltipValue,
} from "@zoonk/ui/components/chart-tooltip";
import { isValidChartPayload } from "@zoonk/utils/chart";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ChartPoint = { label: string; value: number | null };

const TARGET_STEPS = 4;
// oxlint-disable-next-line eslint/no-magic-numbers -- The 1, 2, 5 series of round axis steps.
const NICE_STEPS = [1, 2, 5, 10];
// oxlint-disable-next-line eslint/no-magic-numbers -- Quarters of a percent axis.
const PERCENT_TICKS = [0, 25, 50, 75, 100];

/**
 * Evenly spaced ticks from 0 that reach the largest value: steps of 1, 2 or 5 times a power of ten.
 * Recharts' own ticks end on the largest value itself, which leaves one short step at the top.
 */
function getEvenTicks(maximumValue: number): number[] {
  const rough = Math.max(maximumValue, 1) / TARGET_STEPS;
  const magnitude = 10 ** Math.floor(Math.log10(rough));

  const step = Math.max(
    1,
    (NICE_STEPS.find((nice) => nice * magnitude >= rough) ?? 10) * magnitude,
  );

  const count = Math.max(1, Math.ceil(maximumValue / step));

  return Array.from({ length: count + 1 }, (_, index) => index * step);
}

const MINUTE = 60;
const HOUR = 3600;
// oxlint-disable-next-line eslint/no-magic-numbers -- Round steps of a clock: 1, 5, 10, 15 and 30 minutes, then hours.
const TIME_STEPS = [1, 5, 10, 15, 30].map((minutes) => minutes * MINUTE);

/** A duration axis steps in round times (15 minutes, an hour), never in tenths of an hour. */
function getTimeTicks(maximumValue: number): number[] {
  const rough = Math.max(maximumValue, MINUTE) / TARGET_STEPS;
  const magnitude = 10 ** Math.max(0, Math.floor(Math.log10(rough / HOUR)));
  const hours = NICE_STEPS.map((nice) => nice * HOUR * magnitude);
  const step = [...TIME_STEPS, ...hours].find((time) => time >= rough) ?? HOUR;
  const count = Math.max(1, Math.ceil(maximumValue / step));

  return Array.from({ length: count + 1 }, (_, index) => index * step);
}

function getTicks({
  format,
  maximumValue,
}: {
  format: ChartValueFormat;
  maximumValue: number;
}): number[] {
  if (format === "percent") {
    return PERCENT_TICKS;
  }

  return format === "duration" ? getTimeTicks(maximumValue) : getEvenTicks(maximumValue);
}

/** The smallest text size (`text-2xs`), which an SVG label can't take from a class. */
const TICK_FONT_SIZE = 11.5;

/** Mono figures that end on one edge, like a column of numbers. */
const VALUE_TICK = {
  fill: "var(--muted-foreground)",
  fontFamily: "var(--font-mono)",
  fontSize: TICK_FONT_SIZE,
};

const BAR_CORNER = 4;
const BAR_RADIUS: [number, number, number, number] = [BAR_CORNER, BAR_CORNER, 0, 0];
const MAX_BAR_SIZE = 24;
const DATE_LABELS = 8;

function BarTooltip({
  active,
  format,
  payload,
}: {
  active?: boolean;
  format: ChartValueFormat;
  payload?: unknown;
}) {
  if (!active || !isValidChartPayload<ChartPoint>(payload)) {
    return null;
  }

  const point = payload[0].payload;

  return (
    <ChartTooltipContent>
      <ChartTooltipLabel>{point.label}</ChartTooltipLabel>
      <ChartTooltipValue>{formatChartValue({ format, value: point.value })}</ChartTooltipValue>
    </ChartTooltipContent>
  );
}

/**
 * Admin's one chart of a number over time: bars from zero in the text color, a hairline grid, value
 * labels on the chart's start edge and evenly spaced dates. Hovering a bar says its date and value.
 * Its caller sets the height (`className`) and names it (`label`).
 */
export function AdminBarChart({
  className,
  format,
  label,
  points,
}: {
  className: string;
  format: ChartValueFormat;
  label: string;
  points: ChartPoint[];
}) {
  const maximumValue = Math.max(0, ...points.map((point) => point.value ?? 0));
  const ticks = getTicks({ format, maximumValue });
  // A fixed step, so the dates are evenly spaced whatever each one's width.
  const labelEvery = Math.max(1, Math.ceil(points.length / DATE_LABELS));

  return (
    <figure aria-label={label} className={className} data-slot="admin-bar-chart">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={points} margin={{ bottom: 0, left: 0, right: 0, top: 8 }}>
          <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="label"
            fontSize={TICK_FONT_SIZE}
            interval={labelEvery - 1}
            padding={{ left: 8, right: 8 }}
            stroke="var(--muted-foreground)"
            tickLine={false}
            tickMargin={8}
          />
          <YAxis
            allowDecimals={format === "duration" || format === "percent"}
            axisLine={false}
            domain={[0, ticks.at(-1) ?? 1]}
            tick={VALUE_TICK}
            tickFormatter={(value: number) => formatChartTick({ format, value })}
            tickLine={false}
            ticks={ticks}
            width="auto"
          />
          <Tooltip
            content={<BarTooltip format={format} />}
            cursor={{ fill: "var(--muted)" }}
            isAnimationActive={false}
          />
          <Bar
            dataKey="value"
            fill="var(--foreground)"
            isAnimationActive={false}
            maxBarSize={MAX_BAR_SIZE}
            radius={BAR_RADIUS}
          />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}

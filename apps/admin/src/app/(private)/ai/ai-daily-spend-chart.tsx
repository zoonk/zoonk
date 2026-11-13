"use client";

import {
  CHART_CATEGORY_PADDING,
  CHART_TICK_FONT_SIZE,
  ChartValueTick,
  getEvenTicks,
} from "@/components/chart-axis";
import { formatUsd } from "@/lib/ai-format";
import { isValidChartPayload } from "@zoonk/utils/chart";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type DailySpendPoint = { costUsd: number; label: string };

const BAR_CORNER_RADIUS = 4;
const BAR_RADIUS: [number, number, number, number] = [BAR_CORNER_RADIUS, BAR_CORNER_RADIUS, 0, 0];

function DailySpendTooltip({ active, payload }: { active?: boolean; payload?: unknown }) {
  if (!active || !isValidChartPayload<DailySpendPoint>(payload)) {
    return null;
  }

  const point = payload[0].payload;

  return (
    <div className="bg-background rounded-lg border px-3 py-2 shadow-sm">
      <p className="text-muted-foreground text-xs">{point.label}</p>
      <p className="text-sm font-medium tabular-nums">{formatUsd(point.costUsd)}</p>
    </div>
  );
}

const DATE_LABELS = 8;

function formatDollars(value: number): string {
  return `$${Math.round(value).toLocaleString("en")}`;
}

export function AiDailySpendChart({ points }: { points: DailySpendPoint[] }) {
  const ticks = getEvenTicks(Math.max(...points.map((point) => point.costUsd), 0));
  // A fixed step, so the dates are evenly spaced whatever each one's width.
  const labelEvery = Math.max(1, Math.ceil(points.length / DATE_LABELS));

  return (
    <figure aria-label="AI spend per day" className="h-56 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={points} margin={{ bottom: 0, left: 0, right: 0, top: 8 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="label"
            fontSize={CHART_TICK_FONT_SIZE}
            interval={labelEvery - 1}
            padding={CHART_CATEGORY_PADDING}
            stroke="var(--muted-foreground)"
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            domain={[0, ticks.at(-1) ?? 1]}
            tick={<ChartValueTick format={formatDollars} />}
            tickLine={false}
            ticks={ticks}
            width={44}
          />
          <Tooltip content={<DailySpendTooltip />} cursor={{ fill: "var(--muted)" }} />
          <Bar dataKey="costUsd" fill="var(--primary)" maxBarSize={32} radius={BAR_RADIUS} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}

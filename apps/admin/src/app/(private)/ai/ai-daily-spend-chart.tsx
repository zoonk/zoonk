"use client";

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

/** What AI calls cost each day of the period, so a spike points at the day to look into. */
export function AiDailySpendChart({ points }: { points: DailySpendPoint[] }) {
  return (
    <figure aria-label="AI spend per day" className="h-56 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={points} margin={{ bottom: 0, left: 0, right: 8, top: 8 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="label"
            fontSize={11}
            interval="preserveStartEnd"
            stroke="var(--muted-foreground)"
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            fontSize={11}
            stroke="var(--muted-foreground)"
            tickFormatter={(value: number) => `$${Math.round(value)}`}
            tickLine={false}
            width={44}
          />
          <Tooltip content={<DailySpendTooltip />} cursor={{ fill: "var(--muted)" }} />
          <Bar dataKey="costUsd" fill="var(--primary)" maxBarSize={32} radius={BAR_RADIUS} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}

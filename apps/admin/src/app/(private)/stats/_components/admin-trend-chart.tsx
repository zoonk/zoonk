"use client";

import { isValidChartPayload } from "@zoonk/utils/chart";
import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type DataPoint = {
  date: string;
  label: string;
  value: number;
};

export function AdminTrendChart({
  average,
  dataPoints,
  valueLabel,
}: {
  average: number;
  dataPoints: DataPoint[];
  valueLabel: string;
}) {
  const gradientId = useId();

  return (
    <figure aria-label={`${valueLabel} chart`} className="h-64 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <AreaChart data={dataPoints} margin={{ bottom: 0, left: 0, right: 0, top: 10 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="var(--foreground)" stopOpacity={0.15} />
              <stop offset="95%" stopColor="var(--foreground)" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />

          <XAxis
            axisLine={false}
            dataKey="label"
            fontSize={12}
            stroke="var(--muted-foreground)"
            tickLine={false}
            tickMargin={8}
          />

          <YAxis
            axisLine={false}
            fontSize={12}
            stroke="var(--muted-foreground)"
            tickLine={false}
            tickMargin={8}
            width={40}
          />

          <Tooltip
            content={({ active, payload }) => {
              if (!active || !isValidChartPayload<DataPoint>(payload)) {
                return null;
              }

              const data = payload[0].payload;

              return (
                <div className="bg-background rounded-lg border px-3 py-2 shadow-sm">
                  <p className="text-muted-foreground text-xs">{data.label}</p>
                  <p className="text-sm font-medium">
                    {data.value.toLocaleString()} {valueLabel}
                  </p>
                </div>
              );
            }}
          />

          <ReferenceLine
            label={{
              fill: "var(--muted-foreground)",
              fontSize: 11,
              position: "insideBottomRight",
              value: `Avg: ${average.toLocaleString()}`,
            }}
            stroke="var(--muted-foreground)"
            strokeDasharray="3 3"
            y={average}
          />

          <Area
            dataKey="value"
            fill={`url(#${gradientId})`}
            fillOpacity={1}
            stroke="var(--foreground)"
            strokeWidth={2}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    </figure>
  );
}

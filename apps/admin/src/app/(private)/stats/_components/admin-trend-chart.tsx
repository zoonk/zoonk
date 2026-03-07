"use client";

import { isValidChartPayload } from "@zoonk/utils/chart";
import { useId } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const BAR_LABEL_THRESHOLD = 12;
const BAR_MARGIN_TOP = 10;
const BAR_MARGIN_TOP_WITH_LABELS = 20;
const BAR_OPACITY = 0.8;
const BAR_CORNER_RADIUS = 4;
const BAR_RADIUS: [number, number, number, number] = [BAR_CORNER_RADIUS, BAR_CORNER_RADIUS, 0, 0];

type DataPoint = {
  date: string;
  label: string;
  value: number;
};

export function AdminTrendChart({
  average,
  dataPoints,
  valueLabel,
  variant = "area",
}: {
  average: number;
  dataPoints: DataPoint[];
  valueLabel: string;
  variant?: "area" | "bar";
}) {
  const gradientId = useId();
  const showBarLabels = variant === "bar" && dataPoints.length <= BAR_LABEL_THRESHOLD;

  const sharedElements = (
    <>
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
    </>
  );

  return (
    <figure aria-label={`${valueLabel} chart`} className="h-64 w-full">
      <ResponsiveContainer height="100%" width="100%">
        {variant === "bar" ? (
          <BarChart
            data={dataPoints}
            margin={{
              bottom: 0,
              left: 0,
              right: 0,
              top: showBarLabels ? BAR_MARGIN_TOP_WITH_LABELS : BAR_MARGIN_TOP,
            }}
          >
            {sharedElements}
            <Bar dataKey="value" fill="var(--foreground)" opacity={BAR_OPACITY} radius={BAR_RADIUS}>
              {showBarLabels ? (
                <LabelList
                  dataKey="value"
                  fill="var(--muted-foreground)"
                  formatter={(value) => Number(value).toLocaleString()}
                  fontSize={11}
                  offset={8}
                  position="top"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                />
              ) : null}
            </Bar>
          </BarChart>
        ) : (
          <AreaChart data={dataPoints} margin={{ bottom: 0, left: 0, right: 0, top: 10 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--foreground)" stopOpacity={0.15} />
                <stop offset="95%" stopColor="var(--foreground)" stopOpacity={0} />
              </linearGradient>
            </defs>

            {sharedElements}

            <Area
              dataKey="value"
              fill={`url(#${gradientId})`}
              fillOpacity={1}
              stroke="var(--foreground)"
              strokeWidth={2}
              type="monotone"
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </figure>
  );
}

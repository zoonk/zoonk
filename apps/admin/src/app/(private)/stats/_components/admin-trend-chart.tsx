"use client";

import { isValidChartPayload } from "@zoonk/utils/chart";
import {
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

type DataPoint = { date: string; label: string; value: number };

/**
 * Keeps the Recharts payload guard outside the chart render path so the
 * tooltip renderer has a stable identity. Recharts passes `active` and
 * `payload` at runtime, while this component owns the admin-specific label and
 * value formatting.
 */
function AdminTrendTooltip({
  active,
  payload,
  valueLabel,
}: {
  active?: boolean;
  payload?: unknown;
  valueLabel: string;
}) {
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
}

/**
 * Admin trend pages use bars for discrete daily, weekly, monthly, or yearly
 * buckets so changes read as comparable counts instead of continuous movement.
 */
export function AdminTrendChart({
  average,
  dataPoints,
  valueLabel,
}: {
  average: number;
  dataPoints: DataPoint[];
  valueLabel: string;
}) {
  const showBarLabels = dataPoints.length <= BAR_LABEL_THRESHOLD;

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

      <Tooltip content={<AdminTrendTooltip valueLabel={valueLabel} />} />

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
      </ResponsiveContainer>
    </figure>
  );
}

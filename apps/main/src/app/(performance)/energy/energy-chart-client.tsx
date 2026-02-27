"use client";

import { isValidChartPayload } from "@zoonk/utils/chart";
import { useExtracted } from "next-intl";
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

type SerializedDataPoint = {
  date: string;
  energy: number;
  label: string;
};

export function EnergyChartClient({
  average,
  dataPoints,
}: {
  average: number;
  dataPoints: SerializedDataPoint[];
}) {
  const t = useExtracted();

  return (
    <figure aria-label={t("Energy chart")} className="h-64 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <AreaChart data={dataPoints} margin={{ bottom: 0, left: 0, right: 0, top: 10 }}>
          <defs>
            <linearGradient id="energyGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="var(--energy)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--energy)" stopOpacity={0} />
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
            domain={[0, 100]}
            fontSize={12}
            stroke="var(--muted-foreground)"
            tickLine={false}
            tickMargin={8}
            width={40}
          />

          <Tooltip
            content={({ active, payload }) => {
              if (!(active && isValidChartPayload<SerializedDataPoint>(payload))) {
                return null;
              }

              const data = payload[0].payload;
              const value = Number(data.energy).toFixed(1);

              return (
                <div className="bg-background rounded-lg border px-3 py-2 shadow-sm">
                  <p className="text-muted-foreground text-xs">{data.label}</p>
                  <p className="text-energy text-sm font-medium">{t("{value}%", { value })}</p>
                </div>
              );
            }}
          />

          <ReferenceLine
            label={{
              fill: "var(--muted-foreground)",
              fontSize: 11,
              position: "insideBottomRight",
              value: `${t("Avg")}: ${average.toFixed(1)}%`,
            }}
            stroke="var(--muted-foreground)"
            strokeDasharray="3 3"
            y={average}
          />

          <Area
            dataKey="energy"
            fill="url(#energyGradient)"
            fillOpacity={1}
            stroke="var(--energy)"
            strokeWidth={2}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    </figure>
  );
}

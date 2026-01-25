"use client";

import { useExtracted, useLocale } from "next-intl";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { isValidChartPayload } from "../_lib/chart-payload";

type SerializedDataPoint = {
  date: string;
  bp: number;
  label: string;
};

export function LevelChartClient({
  dataPoints,
  total,
}: {
  dataPoints: SerializedDataPoint[];
  total: number;
}) {
  const t = useExtracted();
  const locale = useLocale();

  const formattedTotal = new Intl.NumberFormat(locale).format(total);

  return (
    <figure aria-label={t("Brain Power chart")} className="h-64 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <AreaChart data={dataPoints} margin={{ bottom: 0, left: 0, right: 0, top: 10 }}>
          <defs>
            <linearGradient id="bpGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />

          <XAxis
            axisLine={false}
            dataKey="label"
            fontSize={12}
            stroke="var(--muted-foreground)"
            tickLine={false}
          />

          <YAxis
            axisLine={false}
            fontSize={12}
            stroke="var(--muted-foreground)"
            tickFormatter={(value: number) =>
              new Intl.NumberFormat(locale, { notation: "compact" }).format(value)
            }
            tickLine={false}
            width={48}
          />

          <Tooltip
            content={({ active, payload }) => {
              if (!(active && isValidChartPayload<SerializedDataPoint>(payload))) {
                return null;
              }

              const data = payload[0].payload;
              const formattedValue = new Intl.NumberFormat(locale).format(data.bp);

              return (
                <div className="bg-background rounded-lg border px-3 py-2 shadow-sm">
                  <p className="text-muted-foreground text-xs">{data.label}</p>
                  <p className="text-sm font-medium">
                    {t("{value} BP", { value: formattedValue })}
                  </p>
                </div>
              );
            }}
          />

          <Area
            dataKey="bp"
            fill="url(#bpGradient)"
            stroke="var(--primary)"
            strokeWidth={2}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>

      <figcaption className="sr-only">
        {t("Total Brain Power earned: {total}", { total: formattedTotal })}
      </figcaption>
    </figure>
  );
}

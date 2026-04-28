"use client";

import { useExtracted, useLocale } from "next-intl";
import {
  PerformanceAreaChart,
  PerformanceChartArea,
  PerformanceChartCompactYAxis,
  PerformanceChartFigure,
  PerformanceChartGradient,
  PerformanceChartGrid,
  PerformanceChartTooltip,
  PerformanceChartTooltipContent,
  PerformanceChartTooltipLabel,
  PerformanceChartTooltipValue,
  PerformanceChartXAxis,
} from "../_components/performance-area-chart";

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
  const color = "var(--primary)";
  const gradientId = "bpGradient";

  return (
    <PerformanceChartFigure label={t("Brain Power chart")}>
      <PerformanceAreaChart data={dataPoints}>
        <defs>
          <PerformanceChartGradient color={color} id={gradientId} />
        </defs>

        <PerformanceChartGrid />
        <PerformanceChartXAxis />
        <PerformanceChartCompactYAxis locale={locale} />

        <PerformanceChartTooltip<SerializedDataPoint>>
          {(data) => {
            const formattedValue = new Intl.NumberFormat(locale).format(data.bp);

            return (
              <PerformanceChartTooltipContent>
                <PerformanceChartTooltipLabel>{data.label}</PerformanceChartTooltipLabel>
                <PerformanceChartTooltipValue>
                  {t("{value} BP", { value: formattedValue })}
                </PerformanceChartTooltipValue>
              </PerformanceChartTooltipContent>
            );
          }}
        </PerformanceChartTooltip>

        <PerformanceChartArea color={color} dataKey="bp" gradientId={gradientId} />
      </PerformanceAreaChart>

      <figcaption className="sr-only">
        {t("Total Brain Power earned: {total}", { total: formattedTotal })}
      </figcaption>
    </PerformanceChartFigure>
  );
}

"use client";

import { useExtracted, useLocale } from "next-intl";
import {
  ProgressAreaChart,
  ProgressChartArea,
  ProgressChartCompactYAxis,
  ProgressChartFigure,
  ProgressChartGradient,
  ProgressChartGrid,
  ProgressChartTooltip,
  ProgressChartTooltipContent,
  ProgressChartTooltipLabel,
  ProgressChartTooltipValue,
  ProgressChartXAxis,
} from "../_components/progress-area-chart";

type SerializedDataPoint = { date: string; bp: number; label: string };

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
    <ProgressChartFigure label={t("Brain Power chart")}>
      <ProgressAreaChart data={dataPoints}>
        <defs>
          <ProgressChartGradient color={color} id={gradientId} />
        </defs>

        <ProgressChartGrid />
        <ProgressChartXAxis />
        <ProgressChartCompactYAxis locale={locale} />

        <ProgressChartTooltip<SerializedDataPoint>>
          {(data) => {
            const formattedValue = new Intl.NumberFormat(locale).format(data.bp);

            return (
              <ProgressChartTooltipContent>
                <ProgressChartTooltipLabel>{data.label}</ProgressChartTooltipLabel>
                <ProgressChartTooltipValue>
                  {t("{value} BP", { value: formattedValue })}
                </ProgressChartTooltipValue>
              </ProgressChartTooltipContent>
            );
          }}
        </ProgressChartTooltip>

        <ProgressChartArea color={color} dataKey="bp" gradientId={gradientId} />
      </ProgressAreaChart>

      <figcaption className="sr-only">
        {t("Total Brain Power earned: {total}", { total: formattedTotal })}
      </figcaption>
    </ProgressChartFigure>
  );
}

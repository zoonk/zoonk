"use client";

import { formatCompactNumber, formatWholeNumber } from "@zoonk/utils/number";
import { useExtracted, useFormatter } from "next-intl";
import {
  ProgressBarChart,
  ProgressChartBar,
  ProgressChartCompactYAxis,
  ProgressChartFigure,
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
  const format = useFormatter();

  const formattedTotal = formatWholeNumber({ format, value: total });
  const color = "var(--primary)";

  return (
    <ProgressChartFigure label={t("Brain Power chart")}>
      <ProgressBarChart data={dataPoints}>
        <ProgressChartGrid />
        <ProgressChartXAxis />
        <ProgressChartCompactYAxis
          formatValue={(value) => formatCompactNumber({ format, value })}
        />

        <ProgressChartTooltip<SerializedDataPoint>>
          {(data) => {
            const formattedValue = formatWholeNumber({ format, value: data.bp });

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

        <ProgressChartBar color={color} dataKey="bp" />
      </ProgressBarChart>

      <figcaption className="sr-only">
        {t("Total Brain Power earned: {total}", { total: formattedTotal })}
      </figcaption>
    </ProgressChartFigure>
  );
}

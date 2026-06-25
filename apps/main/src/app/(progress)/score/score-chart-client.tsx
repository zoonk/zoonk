"use client";

import { formatMetricPercent } from "@zoonk/utils/number";
import { useExtracted, useFormatter } from "next-intl";
import {
  ProgressAreaChart,
  ProgressChartArea,
  ProgressChartAverageLine,
  ProgressChartFigure,
  ProgressChartGradient,
  ProgressChartGrid,
  ProgressChartPercentYAxis,
  ProgressChartTooltip,
  ProgressChartTooltipContent,
  ProgressChartTooltipLabel,
  ProgressChartTooltipValue,
  ProgressChartXAxis,
} from "../_components/progress-area-chart";

type SerializedDataPoint = { date: string; label: string; score: number };

export function ScoreChartClient({
  average,
  dataPoints,
}: {
  average: number;
  dataPoints: SerializedDataPoint[];
}) {
  const t = useExtracted();
  const format = useFormatter();
  const color = "var(--score)";
  const gradientId = "scoreGradient";
  const formattedAverage = formatMetricPercent({ format, value: average });

  return (
    <ProgressChartFigure label={t("Score chart")}>
      <ProgressAreaChart data={dataPoints}>
        <defs>
          <ProgressChartGradient color={color} id={gradientId} />
        </defs>

        <ProgressChartGrid />
        <ProgressChartXAxis />
        <ProgressChartPercentYAxis />

        <ProgressChartTooltip<SerializedDataPoint>>
          {(data) => {
            const formattedScore = formatMetricPercent({ format, value: data.score });

            return (
              <ProgressChartTooltipContent>
                <ProgressChartTooltipLabel>{data.label}</ProgressChartTooltipLabel>
                <ProgressChartTooltipValue className="text-score">
                  {formattedScore}
                </ProgressChartTooltipValue>
              </ProgressChartTooltipContent>
            );
          }}
        </ProgressChartTooltip>

        <ProgressChartAverageLine
          y={average}
        >{`${t("Avg")}: ${formattedAverage}`}</ProgressChartAverageLine>

        <ProgressChartArea color={color} dataKey="score" gradientId={gradientId} />
      </ProgressAreaChart>
    </ProgressChartFigure>
  );
}

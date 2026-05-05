"use client";

import { useExtracted } from "next-intl";
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
  const color = "var(--score)";
  const gradientId = "scoreGradient";

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
            const value = data.score.toFixed(1);

            return (
              <ProgressChartTooltipContent>
                <ProgressChartTooltipLabel>{data.label}</ProgressChartTooltipLabel>
                <ProgressChartTooltipValue className="text-score">
                  {t("{value}%", { value })}
                </ProgressChartTooltipValue>
              </ProgressChartTooltipContent>
            );
          }}
        </ProgressChartTooltip>

        <ProgressChartAverageLine y={average}>
          {`${t("Avg")}: ${average.toFixed(1)}%`}
        </ProgressChartAverageLine>

        <ProgressChartArea color={color} dataKey="score" gradientId={gradientId} />
      </ProgressAreaChart>
    </ProgressChartFigure>
  );
}

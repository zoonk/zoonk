"use client";

import { useExtracted } from "next-intl";
import {
  PerformanceAreaChart,
  PerformanceChartArea,
  PerformanceChartAverageLine,
  PerformanceChartFigure,
  PerformanceChartGradient,
  PerformanceChartGrid,
  PerformanceChartPercentYAxis,
  PerformanceChartTooltip,
  PerformanceChartTooltipContent,
  PerformanceChartTooltipLabel,
  PerformanceChartTooltipValue,
  PerformanceChartXAxis,
} from "../_components/performance-area-chart";

type SerializedDataPoint = {
  date: string;
  label: string;
  score: number;
};

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
    <PerformanceChartFigure label={t("Score chart")}>
      <PerformanceAreaChart data={dataPoints}>
        <defs>
          <PerformanceChartGradient color={color} id={gradientId} />
        </defs>

        <PerformanceChartGrid />
        <PerformanceChartXAxis />
        <PerformanceChartPercentYAxis />

        <PerformanceChartTooltip<SerializedDataPoint>>
          {(data) => {
            const value = data.score.toFixed(1);

            return (
              <PerformanceChartTooltipContent>
                <PerformanceChartTooltipLabel>{data.label}</PerformanceChartTooltipLabel>
                <PerformanceChartTooltipValue className="text-score">
                  {t("{value}%", { value })}
                </PerformanceChartTooltipValue>
              </PerformanceChartTooltipContent>
            );
          }}
        </PerformanceChartTooltip>

        <PerformanceChartAverageLine y={average}>
          {`${t("Avg")}: ${average.toFixed(1)}%`}
        </PerformanceChartAverageLine>

        <PerformanceChartArea color={color} dataKey="score" gradientId={gradientId} />
      </PerformanceAreaChart>
    </PerformanceChartFigure>
  );
}

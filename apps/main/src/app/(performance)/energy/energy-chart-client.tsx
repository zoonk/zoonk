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
  const color = "var(--energy)";
  const gradientId = "energyGradient";

  return (
    <PerformanceChartFigure label={t("Energy chart")}>
      <PerformanceAreaChart data={dataPoints}>
        <defs>
          <PerformanceChartGradient color={color} id={gradientId} />
        </defs>

        <PerformanceChartGrid />
        <PerformanceChartXAxis />
        <PerformanceChartPercentYAxis />

        <PerformanceChartTooltip<SerializedDataPoint>>
          {(data) => {
            const value = data.energy.toFixed(1);

            return (
              <PerformanceChartTooltipContent>
                <PerformanceChartTooltipLabel>{data.label}</PerformanceChartTooltipLabel>
                <PerformanceChartTooltipValue className="text-energy">
                  {t("{value}%", { value })}
                </PerformanceChartTooltipValue>
              </PerformanceChartTooltipContent>
            );
          }}
        </PerformanceChartTooltip>

        <PerformanceChartAverageLine y={average}>
          {`${t("Avg")}: ${average.toFixed(1)}%`}
        </PerformanceChartAverageLine>

        <PerformanceChartArea color={color} dataKey="energy" gradientId={gradientId} />
      </PerformanceAreaChart>
    </PerformanceChartFigure>
  );
}

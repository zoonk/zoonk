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

type SerializedDataPoint = { date: string; energy: number; label: string };

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
    <ProgressChartFigure label={t("Energy chart")}>
      <ProgressAreaChart data={dataPoints}>
        <defs>
          <ProgressChartGradient color={color} id={gradientId} />
        </defs>

        <ProgressChartGrid />
        <ProgressChartXAxis />
        <ProgressChartPercentYAxis />

        <ProgressChartTooltip<SerializedDataPoint>>
          {(data) => {
            const value = data.energy.toFixed(1);

            return (
              <ProgressChartTooltipContent>
                <ProgressChartTooltipLabel>{data.label}</ProgressChartTooltipLabel>
                <ProgressChartTooltipValue className="text-energy">
                  {t("{value}%", { value })}
                </ProgressChartTooltipValue>
              </ProgressChartTooltipContent>
            );
          }}
        </ProgressChartTooltip>

        <ProgressChartAverageLine y={average}>
          {`${t("Avg")}: ${average.toFixed(1)}%`}
        </ProgressChartAverageLine>

        <ProgressChartArea color={color} dataKey="energy" gradientId={gradientId} />
      </ProgressAreaChart>
    </ProgressChartFigure>
  );
}

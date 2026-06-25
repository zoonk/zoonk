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

type SerializedDataPoint = { date: string; energy: number; label: string };

export function EnergyChartClient({
  average,
  dataPoints,
}: {
  average: number;
  dataPoints: SerializedDataPoint[];
}) {
  const t = useExtracted();
  const format = useFormatter();
  const color = "var(--energy)";
  const gradientId = "energyGradient";
  const formattedAverage = formatMetricPercent({ format, value: average });

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
            const formattedEnergy = formatMetricPercent({ format, value: data.energy });

            return (
              <ProgressChartTooltipContent>
                <ProgressChartTooltipLabel>{data.label}</ProgressChartTooltipLabel>
                <ProgressChartTooltipValue className="text-energy">
                  {formattedEnergy}
                </ProgressChartTooltipValue>
              </ProgressChartTooltipContent>
            );
          }}
        </ProgressChartTooltip>

        <ProgressChartAverageLine
          y={average}
        >{`${t("Avg")}: ${formattedAverage}`}</ProgressChartAverageLine>

        <ProgressChartArea color={color} dataKey="energy" gradientId={gradientId} />
      </ProgressAreaChart>
    </ProgressChartFigure>
  );
}

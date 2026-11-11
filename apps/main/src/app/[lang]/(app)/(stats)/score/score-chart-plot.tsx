"use client";

import {
  ChartTooltipContent,
  ChartTooltipLabel,
  ChartTooltipNote,
  ChartTooltipValue,
} from "@zoonk/ui/components/chart-tooltip";
import { formatMetricPercent } from "@zoonk/utils/number";
import { useExtracted, useFormatter } from "next-intl";
import {
  ProgressChartGrid,
  ProgressChartLine,
  ProgressChartPercentYAxis,
  ProgressChartTooltip,
  ProgressChartXAxis,
  ProgressLineChart,
} from "../_components/progress-line-chart";
import { type SerializedScoreDataPoint } from "./score-chart";

export function ScoreChartPlot({ dataPoints }: { dataPoints: SerializedScoreDataPoint[] }) {
  const t = useExtracted();
  const format = useFormatter();

  return (
    <ProgressLineChart data={dataPoints}>
      <ProgressChartGrid />
      <ProgressChartXAxis />
      <ProgressChartPercentYAxis />

      <ProgressChartTooltip<SerializedScoreDataPoint>>
        {(data) => (
          <div aria-live="polite" role="status">
            <ChartTooltipContent>
              <ChartTooltipLabel>{data.label}</ChartTooltipLabel>
              <ChartTooltipValue className="text-success-text">
                {formatMetricPercent({ format, value: data.score })}
              </ChartTooltipValue>
              <ChartTooltipNote>
                {t("{count, plural, one {# answer} other {# answers}}", {
                  count: data.totalAnswers,
                })}
              </ChartTooltipNote>
            </ChartTooltipContent>
          </div>
        )}
      </ProgressChartTooltip>

      <ProgressChartLine color="var(--score)" dataKey="score" />
    </ProgressLineChart>
  );
}

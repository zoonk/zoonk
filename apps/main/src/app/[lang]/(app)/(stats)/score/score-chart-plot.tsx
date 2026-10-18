"use client";

import { formatMetricPercent } from "@zoonk/utils/number";
import { useExtracted, useFormatter } from "next-intl";
import {
  ProgressChartGrid,
  ProgressChartLine,
  ProgressChartPercentYAxis,
  ProgressChartTooltip,
  ProgressChartTooltipContent,
  ProgressChartTooltipLabel,
  ProgressChartTooltipValue,
  ProgressChartXAxis,
  ProgressLineChart,
} from "../_components/progress-line-chart";
import { type SerializedScoreDataPoint } from "./score-chart";

/** Score's weekly trend drawn with Recharts: the line, and each week's detail under the pointer. */
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
            <ProgressChartTooltipContent>
              <ProgressChartTooltipLabel>{data.label}</ProgressChartTooltipLabel>
              <ProgressChartTooltipValue className="text-success-text">
                {formatMetricPercent({ format, value: data.score })}
              </ProgressChartTooltipValue>
              <p className="text-muted-foreground text-xs">
                {t("{count, plural, one {# answer} other {# answers}}", {
                  count: data.totalAnswers,
                })}
              </p>
            </ProgressChartTooltipContent>
          </div>
        )}
      </ProgressChartTooltip>

      <ProgressChartLine color="var(--score)" dataKey="score" />
    </ProgressLineChart>
  );
}

"use client";

import { type ScorePerformance } from "@zoonk/core/progress/score-performance";
import { formatMetricPercent } from "@zoonk/utils/number";
import { useExtracted, useFormatter } from "next-intl";
import {
  ProgressAreaChart,
  ProgressChartArea,
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

type SerializedScoreDataPoint = ScorePerformance & { date: string; label: string };

/**
 * Shows the rolling Score as one weekly trend under the headline, which already names the window.
 * The pointer tooltip gives visual detail, and the screen-reader caption lists every weekly score
 * with its answer volume.
 */
export function ScoreChartClient({
  dataPoints,
  performance,
}: {
  dataPoints: SerializedScoreDataPoint[];
  performance: ScorePerformance;
}) {
  const t = useExtracted();
  const format = useFormatter();
  const color = "var(--score)";
  const gradientId = "scoreGradient";
  const formattedScore = formatMetricPercent({ format, value: performance.score });

  return (
    <ProgressChartFigure label={t("Weekly score trend")}>
      <figcaption className="sr-only">
        {t("{score} across {count, plural, one {# answer} other {# answers}}", {
          count: performance.totalAnswers,
          score: formattedScore,
        })}
        <ul>
          {dataPoints.map((dataPoint) => (
            <li key={dataPoint.date}>
              {t("{label}: {score} across {count, plural, one {# answer} other {# answers}}", {
                count: dataPoint.totalAnswers,
                label: dataPoint.label,
                score: formatMetricPercent({ format, value: dataPoint.score }),
              })}
            </li>
          ))}
        </ul>
      </figcaption>

      <ProgressAreaChart data={dataPoints}>
        <defs>
          <ProgressChartGradient color={color} id={gradientId} />
        </defs>

        <ProgressChartGrid />
        <ProgressChartXAxis />
        <ProgressChartPercentYAxis />

        <ProgressChartTooltip<SerializedScoreDataPoint>>
          {(data) => {
            const formattedPointScore = formatMetricPercent({ format, value: data.score });

            return (
              <div aria-live="polite" role="status">
                <ProgressChartTooltipContent>
                  <ProgressChartTooltipLabel>{data.label}</ProgressChartTooltipLabel>
                  <ProgressChartTooltipValue className="text-score">
                    {formattedPointScore}
                  </ProgressChartTooltipValue>
                  <p className="text-muted-foreground text-xs">
                    {t("{count, plural, one {# answer} other {# answers}}", {
                      count: data.totalAnswers,
                    })}
                  </p>
                </ProgressChartTooltipContent>
              </div>
            );
          }}
        </ProgressChartTooltip>

        <ProgressChartArea color={color} dataKey="score" gradientId={gradientId} />
      </ProgressAreaChart>
    </ProgressChartFigure>
  );
}

"use client";

import { type ScorePerformance } from "@zoonk/core/progress/score-performance";
import { formatMetricPercent } from "@zoonk/utils/number";
import { useExtracted, useFormatter } from "next-intl";
import { ProgressChartFigure } from "../_components/progress-chart-figure";
import { type SerializedScoreDataPoint } from "./score-chart";

/**
 * The rolling Score as one weekly trend, a blue line on a 0–100 scale; the numbers above it name
 * the window. The screen-reader caption lists every weekly score with its answer volume, and the
 * plot (`children`) gives each week's detail under the pointer.
 */
export function ScoreChartFigure({
  children,
  dataPoints,
  performance,
}: {
  children: React.ReactNode;
  dataPoints: SerializedScoreDataPoint[];
  performance: ScorePerformance;
}) {
  const t = useExtracted();
  const format = useFormatter();
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

      {children}
    </ProgressChartFigure>
  );
}

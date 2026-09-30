"use client";

import { useExtracted } from "next-intl";
import { useState } from "react";
import {
  ActivityCanvas,
  ActivityCanvasLabel,
  ActivityTextAlternative,
} from "../_components/activity-canvas";
import {
  ActivityPlot,
  ActivityPlotAxisX,
  ActivityPlotBand,
  ActivityPlotDot,
  ActivityPlotGridY,
  ActivityPlotLabel,
  ActivityPlotLine,
} from "../_components/activity-plot";
import { ActivitySelectGrid, ActivitySelectGridItem } from "../_components/activity-select-grid";
import { computeActivityValue } from "../_utils/compute-activity-value";
import { niceDomain, niceTicks } from "../_utils/plot-scale";
import { useFormatNumber } from "../_utils/use-format-number";
import { type ActivityRendererProps } from "../activity-renderer";

type ChartReaderProps = ActivityRendererProps<"chartReader">;
type Fields = ChartReaderProps["content"]["fields"];

const PLOT_HEIGHT = 184;
const ENDPOINT_RADIUS = 4.5;
const DELTA_OFFSET = -12;
const PLAIN_NUMBER_LIMIT = 10_000;

/** Years and other whole labels up to four digits read without a thousands separator. */
function isPlainAxis(values: readonly number[]): boolean {
  return values.every((value) => Number.isInteger(value) && Math.abs(value) < PLAIN_NUMBER_LIMIT);
}

function useFormatMeasure(fields: Fields) {
  const t = useExtracted();
  const format = useFormatNumber();

  return (value: number) => {
    if (fields.statistic === "percentChange") {
      return format(value, { signed: true, unit: "%" });
    }

    const change = format(value, { signed: true, unit: fields.yUnit });

    return fields.statistic === "ratePerUnit"
      ? t("{value} per {unit}", { unit: fields.xLabel, value: change })
      : change;
  };
}

function pointAt(fields: Fields, x: number): number {
  return fields.points.find((point) => point.x === x)?.y ?? 0;
}

/**
 * A real dataset to measure: the learner taps spans (like the 1960s and the 2010s) to see how much
 * the line changed in each, so a trend is read from the data instead of stated. Code measures
 * every span with the template's statistic; with a numeric check the last measured span is the
 * answer.
 */
export function ChartReaderActivity({
  content,
  expected,
  labelId,
  onAnswerChange,
  phase,
}: ChartReaderProps) {
  const t = useExtracted();
  const format = useFormatNumber();
  const formatMeasure = useFormatMeasure(content.fields);
  const { check, fields } = content;
  const [selected, setSelected] = useState<string[]>([]);
  const isChecked = phase === "checked";
  const xs = fields.points.map((point) => point.x);
  const xDomain = [Math.min(...xs), Math.max(...xs)] as const;

  const yDomain = niceDomain(
    fields.points.map((point) => point.y),
    { includeZero: false },
  );

  const measure = (spanId: string) => computeActivityValue(content, { output: spanId });
  const targetId = check.kind === "numeric" ? (check.output ?? fields.spans[0]?.id) : null;
  const plainX = isPlainAxis(xs);

  function handleToggle(spanId: string) {
    const next = selected.includes(spanId)
      ? selected.filter((id) => id !== spanId)
      : [...selected, spanId];

    const last = next.at(-1);
    const value = last === undefined ? null : measure(last);
    setSelected(next);

    if (check.kind === "numeric") {
      onAnswerChange(value === null ? null : { kind: "numeric", value });
    }
  }

  const shownSpans = fields.spans.filter(
    (span) =>
      selected.includes(span.id) ||
      (isChecked && expected?.kind === "numeric" && span.id === targetId),
  );

  return (
    <ActivityCanvas labelId={labelId}>
      <ActivityCanvasLabel className="text-foreground text-sm font-medium">
        {fields.yLabel}
      </ActivityCanvasLabel>

      <ActivityPlot height={PLOT_HEIGHT} xDomain={xDomain} yDomain={yDomain}>
        <ActivityPlotGridY
          format={(value) => format(value, { compact: true })}
          ticks={niceTicks(yDomain, 3)}
        />
        <ActivityPlotAxisX
          format={(value) => format(value, { grouping: !plainX })}
          ticks={niceTicks(xDomain, 3)}
        />

        {shownSpans.map((span) => (
          <ActivityPlotBand from={span.from} key={span.id} to={span.to} />
        ))}

        <ActivityPlotLine className="stroke-foreground stroke-2" points={fields.points} />

        {shownSpans.map((span) => {
          const value = measure(span.id);

          return (
            <g key={span.id}>
              <ActivityPlotDot
                className="fill-viz-secondary"
                radius={ENDPOINT_RADIUS}
                x={span.from}
                y={pointAt(fields, span.from)}
              />
              <ActivityPlotDot
                className="fill-viz-secondary"
                radius={ENDPOINT_RADIUS}
                x={span.to}
                y={pointAt(fields, span.to)}
              />
              {value !== null && (
                <ActivityPlotLabel
                  anchor="middle"
                  className="fill-viz-secondary text-xs"
                  dy={DELTA_OFFSET}
                  x={(span.from + span.to) / 2}
                  y={Math.max(pointAt(fields, span.from), pointAt(fields, span.to))}
                >
                  {formatMeasure(value)}
                </ActivityPlotLabel>
              )}
            </g>
          );
        })}
      </ActivityPlot>

      <ActivityCanvasLabel>{fields.xLabel}</ActivityCanvasLabel>

      <ActivityCanvasLabel className="text-sm">{t("Tap a span to measure it")}</ActivityCanvasLabel>

      <ActivitySelectGrid label={t("Spans to measure")}>
        {fields.spans.map((span) => (
          <ActivitySelectGridItem
            disabled={isChecked}
            isSelected={selected.includes(span.id)}
            key={span.id}
            onToggle={() => handleToggle(span.id)}
            resultState={isChecked && span.id === targetId ? "correct" : null}
          >
            {span.label}
          </ActivitySelectGridItem>
        ))}
      </ActivitySelectGrid>

      <ActivityTextAlternative>
        {t("A line chart of {y} by {x}, from {start} at {firstX} to {end} at {lastX}.", {
          end: format(pointAt(fields, xDomain[1]), { unit: fields.yUnit }),
          firstX: format(xDomain[0], { grouping: !plainX }),
          lastX: format(xDomain[1], { grouping: !plainX }),
          start: format(pointAt(fields, xDomain[0]), { unit: fields.yUnit }),
          x: fields.xLabel,
          y: fields.yLabel,
        })}{" "}
        {shownSpans
          .map((span) => {
            const value = measure(span.id);

            return value === null
              ? ""
              : t("{span}: {change}.", { change: formatMeasure(value), span: span.label });
          })
          .join(" ")}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}

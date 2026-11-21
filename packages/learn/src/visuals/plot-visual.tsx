"use client";

import { type PlotVisual } from "@zoonk/core/library/steps/contract";
import { useMeasuredWidth } from "@zoonk/ui/hooks/measured-width";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { SURFACE_CLASS } from "../_components/surface";
import { useFormatNumber } from "../_utils/use-format-number";
import { clampLabelCenter } from "./_utils/category-labels";
import { HEIGHT, LABEL_GAP, LABEL_LINE_HEIGHT, PADDING } from "./_utils/chart-layout";
import { type PlotLayout, drawsDot, getPlotLayout } from "./_utils/plot-layout";
import { getSeriesMark } from "./_utils/series-marks";
import { LABEL_FONT_SIZE, useTextScale } from "./_utils/use-text-scale";
import { SeriesLegend, SeriesLine, SeriesPoint } from "./series-marks";

const FALLBACK_WIDTH = 318;
const TICK_OFFSET = 16;
const REFERENCE_DASH = "4 4";
const COMPACT_FROM = 10_000;

function axisTitle(label: string, unit: string | null): string {
  return unit ? `${label} (${unit})` : label;
}

function isLarge(values: number[]): boolean {
  return Math.max(...values.map((value) => Math.abs(value))) >= COMPACT_FROM;
}

function Grid({ layout }: { layout: PlotLayout }) {
  return layout.yTicks.map((tick) => {
    const y = layout.y.toPixel(tick.value);

    return (
      <g key={tick.value}>
        <line className="stroke-viz-grid" x1={layout.left} x2={layout.plotRight} y1={y} y2={y} />
        <text
          className="fill-muted-foreground"
          dominantBaseline="middle"
          textAnchor="end"
          x={layout.left - LABEL_GAP}
          y={y}
        >
          {tick.label}
        </text>
      </g>
    );
  });
}

function XTicks({ layout, width }: { layout: PlotLayout; width: number }) {
  return layout.xTicks.map((tick) => (
    <text
      className="fill-muted-foreground"
      key={tick.value}
      textAnchor="middle"
      x={clampLabelCenter({ lines: [tick.label], width, x: layout.x.toPixel(tick.value) })}
      y={HEIGHT - PADDING.bottom + TICK_OFFSET}
    >
      {tick.label}
    </text>
  ));
}

function References({ layout }: { layout: PlotLayout }) {
  return layout.references.map((reference) => (
    <g key={`${reference.label}-${String(reference.y)}`}>
      <line
        className="stroke-muted-foreground"
        strokeDasharray={REFERENCE_DASH}
        x1={layout.left}
        x2={layout.plotRight}
        y1={reference.y}
        y2={reference.y}
      />
      <text className="fill-muted-foreground" dominantBaseline="middle">
        {reference.lines.map((line, index) => (
          <tspan
            key={`${line}-${String(index)}`}
            x={layout.plotRight + LABEL_GAP}
            y={reference.top + LABEL_LINE_HEIGHT * index + LABEL_LINE_HEIGHT / 2}
          >
            {line}
          </tspan>
        ))}
      </text>
    </g>
  ));
}

function Series({ layout, visual }: { layout: PlotLayout; visual: PlotVisual }) {
  return visual.series.map((series, seriesIndex) => {
    const mark = getSeriesMark(seriesIndex);
    const points = layout.series[seriesIndex] ?? [];

    return (
      <g key={series.name}>
        {series.mark !== "points" && <SeriesLine mark={mark} points={points} />}
        {points.map((point, index) =>
          drawsDot({
            index,
            mark: series.mark,
            pointCount: points.length,
            seriesCount: visual.series.length,
          }) ? (
            <SeriesPoint
              key={`${String(point.x)}-${String(point.y)}`}
              mark={mark}
              x={point.x}
              y={point.y}
            />
          ) : null,
        )}
      </g>
    );
  });
}

function PointLabels({ layout }: { layout: PlotLayout }) {
  return layout.labels.map((label) => (
    <text
      className="fill-foreground font-medium"
      dominantBaseline="middle"
      key={`${label.text}-${String(label.x)}-${String(label.y)}`}
      textAnchor={label.anchor}
      x={label.x}
      y={label.y}
    >
      {label.text}
    </text>
  ));
}

function PointKey({ layout }: { layout: PlotLayout }) {
  if (layout.key.length === 0) {
    return null;
  }

  return (
    <ol aria-hidden="true" className="flex flex-col gap-1 text-xs">
      {layout.key.map((entry) => (
        <li className="flex gap-2" key={entry.marker}>
          <span className="text-foreground w-4 shrink-0 text-right font-medium tabular-nums">
            {entry.marker}
          </span>
          <span className="text-muted-foreground">{entry.label}</span>
        </li>
      ))}
    </ol>
  );
}

function PlotData({
  groupX,
  layout,
  visual,
}: {
  groupX: boolean;
  layout: PlotLayout;
  visual: PlotVisual;
}) {
  const t = useExtracted();
  const format = useFormatNumber();
  const xUnit = visual.xUnit ?? undefined;
  const yUnit = visual.yUnit ?? undefined;

  return (
    <div className="sr-only">
      <p>
        {t("Horizontal axis: {label}, from {min} to {max}", {
          label: visual.xLabel,
          max: format(layout.x.domain[1], { grouping: groupX, unit: xUnit }),
          min: format(layout.x.domain[0], { grouping: groupX, unit: xUnit }),
        })}
      </p>
      <p>
        {t("Vertical axis: {label}, from {min} to {max}", {
          label: visual.yLabel,
          max: format(layout.y.domain[1], { unit: yUnit }),
          min: format(layout.y.domain[0], { unit: yUnit }),
        })}
      </p>

      {visual.series.map((series) => {
        const named = series.points.some((point) => point.label);

        return (
          <table key={series.name}>
            {visual.series.length > 1 && <caption>{series.name}</caption>}
            <thead>
              <tr>
                {named && <th scope="col">{t("Point")}</th>}
                <th scope="col">{visual.xLabel}</th>
                <th scope="col">{visual.yLabel}</th>
              </tr>
            </thead>
            <tbody>
              {series.points.map((point, index) => (
                <tr key={`${String(point.x)}-${String(point.y)}-${String(index)}`}>
                  {named && <th scope="row">{point.label}</th>}
                  <td>{format(point.x, { grouping: groupX, unit: xUnit })}</td>
                  <td>{format(point.y, { unit: yUnit })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      })}

      {visual.references.length > 0 && (
        <ul aria-label={t("Reference lines")}>
          {visual.references.map((reference) => (
            <li key={`${reference.label}-${String(reference.y)}`}>
              {t("{label}: {value}", {
                label: reference.label,
                value: format(reference.y, { unit: yUnit }),
              })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PlotVisualView({ className, visual }: { className?: string; visual: PlotVisual }) {
  const t = useExtracted();
  const format = useFormatNumber();
  const { ref, width: boxWidth } = useMeasuredWidth<HTMLDivElement>(FALLBACK_WIDTH);
  const scale = useTextScale(ref);
  const width = boxWidth / scale;

  const points = visual.series.flatMap((series) => series.points);
  const compactX = isLarge(points.map((point) => point.x));

  const compactY = isLarge([
    ...points.map((point) => point.y),
    ...visual.references.map(({ y }) => y),
  ]);

  const layout = getPlotLayout({
    formatX: (value) => format(value, { compact: compactX, grouping: compactX }),
    formatY: (value) => format(value, { compact: compactY }),
    visual,
    width,
  });

  return (
    <figure
      className={cn(SURFACE_CLASS, "flex w-full flex-col gap-3 p-4", className)}
      data-slot="plot-visual"
    >
      <figcaption className="text-foreground text-sm font-semibold text-balance">
        {visual.title}
      </figcaption>

      <PlotData groupX={compactX} layout={layout} visual={visual} />

      <SeriesLegend
        series={visual.series.map((series) => ({
          draw: series.mark === "points" ? "point" : "line",
          name: series.name,
        }))}
      />

      <div aria-hidden="true" className="flex flex-col gap-1">
        <p className="text-muted-foreground text-xs">{axisTitle(visual.yLabel, visual.yUnit)}</p>

        <div className="w-full text-xs" ref={ref}>
          <svg
            className="block overflow-visible tabular-nums select-none"
            fontSize={LABEL_FONT_SIZE}
            height={HEIGHT * scale}
            viewBox={`0 0 ${width} ${HEIGHT}`}
            width={boxWidth}
          >
            <Grid layout={layout} />
            <References layout={layout} />
            <Series layout={layout} visual={visual} />
            <PointLabels layout={layout} />
            <XTicks layout={layout} width={width} />
          </svg>
        </div>

        <p className="text-muted-foreground text-xs">{axisTitle(visual.xLabel, visual.xUnit)}</p>
      </div>

      <PointKey layout={layout} />

      {visual.source && (
        <p className="text-muted-foreground text-xs">
          {t("Source: {source}", { source: visual.source })}
        </p>
      )}
    </figure>
  );
}

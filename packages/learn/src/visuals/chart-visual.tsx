"use client";

import { type ChartVisual } from "@zoonk/core/library/steps/contract";
import { placeChartUnit } from "@zoonk/core/library/steps/contract/chart-unit";
import { useMeasuredWidth } from "@zoonk/ui/hooks/measured-width";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useFormatNumber } from "../_utils/use-format-number";
import { clampLabelCenter } from "./_utils/category-labels";
import {
  BAR_GAP,
  type ColumnLayout,
  GROUP_SHARE,
  HEIGHT,
  LABEL_GAP,
  LABEL_LINE_HEIGHT,
  PADDING,
  fitsLabel,
  getLayout,
} from "./_utils/chart-layout";
import { getSeriesMark } from "./_utils/series-marks";
import { LABEL_FONT_SIZE, useTextScale } from "./_utils/use-text-scale";
import { BarRows } from "./chart-bar-rows";
import { SeriesBar, SeriesLine, SeriesPoint, SeriesSwatch } from "./series-marks";

const FALLBACK_WIDTH = 318;
const MIN_LABEL_WIDTH = 30;
const MIN_POINT_LABEL_BAND = 45;
const LABEL_OFFSET = 16;
const POINT_RADIUS = 3.5;

function Grid({ layout, width }: { layout: ColumnLayout; width: number }) {
  return layout.yTicks.map((tick) => {
    const y = layout.y.toPixel(tick.value);

    return (
      <g key={tick.value}>
        <line
          className="stroke-viz-grid"
          x1={layout.left}
          x2={width - PADDING.right}
          y1={y}
          y2={y}
        />
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

function CategoryLabels({
  layout,
  visual,
  width,
}: {
  layout: ColumnLayout;
  visual: ChartVisual;
  width: number;
}) {
  const { lines, step } = layout.labels;

  return visual.categories.map((category, index) => {
    const label = lines[index] ?? [category];
    const x = clampLabelCenter({ lines: label, width, x: layout.center(index) });

    return index % step === 0 ? (
      <text
        className="fill-muted-foreground"
        key={category}
        textAnchor="middle"
        x={x}
        y={HEIGHT - PADDING.bottom + LABEL_OFFSET}
      >
        {label.map((line, lineIndex) => (
          <tspan
            dy={lineIndex === 0 ? 0 : LABEL_LINE_HEIGHT}
            key={`${line}-${String(lineIndex)}`}
            x={x}
          >
            {line}
          </tspan>
        ))}
      </text>
    ) : null;
  });
}

function Bars({
  layout,
  unit,
  visual,
}: {
  layout: ColumnLayout;
  unit: string | null;
  visual: ChartVisual;
}) {
  const format = useFormatNumber();
  const group = layout.band * GROUP_SHARE;
  const barWidth = group / visual.series.length;
  const zero = layout.y.toPixel(Math.max(layout.y.domain[0], 0));

  const showValues =
    barWidth >= MIN_LABEL_WIDTH &&
    visual.series.every((series) =>
      series.values.every((value) =>
        fitsLabel(format(value, { unit: unit ?? undefined }), barWidth),
      ),
    );

  return visual.series.flatMap((series, seriesIndex) =>
    series.values.map((value, index) => {
      const x = layout.center(index) - group / 2 + barWidth * seriesIndex;
      const top = layout.y.toPixel(value);
      const key = `${series.name}-${visual.categories[index] ?? index}`;

      return (
        <g key={key}>
          <SeriesBar
            height={Math.max(Math.abs(zero - top), 1)}
            mark={getSeriesMark(seriesIndex)}
            width={Math.max(barWidth - BAR_GAP, 1)}
            x={x + BAR_GAP / 2}
            y={Math.min(zero, top)}
          />
          {showValues && (
            <text
              className="fill-foreground font-medium"
              textAnchor="middle"
              x={x + barWidth / 2}
              y={Math.min(zero, top) - LABEL_GAP}
            >
              {format(value, { unit: unit ?? undefined })}
            </text>
          )}
        </g>
      );
    }),
  );
}

function Lines({
  layout,
  unit,
  visual,
}: {
  layout: ColumnLayout;
  unit: string | null;
  visual: ChartVisual;
}) {
  const format = useFormatNumber();

  const showValues =
    visual.series.length === 1 &&
    layout.band >= MIN_POINT_LABEL_BAND &&
    visual.series[0]?.values.every((value) =>
      fitsLabel(format(value, { unit: unit ?? undefined }), layout.band),
    );

  return visual.series.map((series, seriesIndex) => {
    const mark = getSeriesMark(seriesIndex);

    const points = series.values.map((value, index) => ({
      x: layout.center(index),
      y: layout.y.toPixel(value),
    }));

    return (
      <g key={series.name}>
        <SeriesLine mark={mark} points={points} />
        {points.map((point, index) => {
          const key = `${series.name}-${visual.categories[index] ?? index}`;

          return (
            <g key={key}>
              <SeriesPoint mark={mark} x={point.x} y={point.y} />
              {showValues && (
                <text
                  className="fill-foreground font-medium"
                  textAnchor="middle"
                  x={point.x}
                  y={point.y - LABEL_GAP - POINT_RADIUS}
                >
                  {format(series.values[index] ?? 0, { unit: unit ?? undefined })}
                </text>
              )}
            </g>
          );
        })}
      </g>
    );
  });
}

function Legend({ visual }: { visual: ChartVisual }) {
  if (visual.series.length < 2) {
    return null;
  }

  return (
    <ul aria-hidden="true" className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {visual.series.map((series, index) => (
        <li className="flex items-center gap-1.5" key={series.name}>
          <SeriesSwatch chart={visual.chart} mark={getSeriesMark(index)} />
          {series.name}
        </li>
      ))}
    </ul>
  );
}

function ChartData({ visual }: { visual: ChartVisual }) {
  const format = useFormatNumber();

  return (
    <table className="sr-only">
      <thead>
        <tr>
          <th scope="col">{visual.categoryLabel}</th>
          {visual.series.map((series) => (
            <th key={series.name} scope="col">
              {visual.series.length > 1 ? series.name : visual.valueLabel}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {visual.categories.map((category, index) => (
          <tr key={category}>
            <th scope="row">{category}</th>
            {visual.series.map((series) => (
              <td key={series.name}>
                {format(series.values[index] ?? 0, { unit: visual.unit ?? undefined })}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ChartVisualView({
  className,
  visual,
}: {
  className?: string;
  visual: ChartVisual;
}) {
  const t = useExtracted();
  const format = useFormatNumber();
  const { ref, width: boxWidth } = useMeasuredWidth<HTMLDivElement>(FALLBACK_WIDTH);
  const scale = useTextScale(ref);
  const width = boxWidth / scale;
  const { numberUnit, valueLabel } = placeChartUnit(visual);

  const layout = getLayout({
    formatTick: (tick) => format(tick, { compact: true, unit: numberUnit ?? undefined }),
    formatValue: (value) => format(value, { unit: numberUnit ?? undefined }),
    visual,
    width,
  });

  const sideways = layout.orientation === "horizontal";

  return (
    <figure
      className={cn("bg-card flex w-full flex-col gap-3 rounded-xl border p-4", className)}
      data-slot="chart-visual"
    >
      <figcaption className="text-foreground text-sm font-semibold text-balance">
        {visual.title}
      </figcaption>

      <Legend visual={visual} />

      <div className="flex flex-col gap-1">
        <p aria-hidden="true" className="text-muted-foreground text-xs">
          {sideways ? visual.categoryLabel : valueLabel}
        </p>

        <div className="w-full text-xs" ref={ref}>
          <svg
            aria-hidden="true"
            className="block overflow-visible tabular-nums select-none"
            fontSize={LABEL_FONT_SIZE}
            height={layout.height * scale}
            viewBox={`0 0 ${width} ${layout.height}`}
            width={boxWidth}
          >
            {layout.orientation === "horizontal" ? (
              <BarRows layout={layout} unit={numberUnit} visual={visual} width={width} />
            ) : (
              <>
                <Grid layout={layout} width={width} />
                {visual.chart === "bar" ? (
                  <Bars layout={layout} unit={numberUnit} visual={visual} />
                ) : (
                  <Lines layout={layout} unit={numberUnit} visual={visual} />
                )}
                <CategoryLabels layout={layout} visual={visual} width={width} />
              </>
            )}
          </svg>
        </div>

        <p aria-hidden="true" className="text-muted-foreground text-center text-xs">
          {sideways ? valueLabel : visual.categoryLabel}
        </p>
      </div>

      <ChartData visual={visual} />

      {visual.source && (
        <p className="text-muted-foreground text-xs">
          {t("Source: {source}", { source: visual.source })}
        </p>
      )}
    </figure>
  );
}

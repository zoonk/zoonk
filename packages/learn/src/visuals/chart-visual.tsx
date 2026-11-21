"use client";

import { type ChartVisual } from "@zoonk/core/library/steps/contract";
import { placeChartUnit } from "@zoonk/core/library/steps/contract/chart-unit";
import { useFormatNumber } from "../_utils/use-format-number";
import { type TextWidth } from "./_utils/category-labels";
import {
  AXIS_LABEL_OFFSET,
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
import { useChartSize } from "./_utils/use-chart-size";
import { useTextWidth } from "./_utils/use-text-width";
import { BarRows } from "./chart-bar-rows";
import { ChartDrawing, ChartFigure, ScreenReaderData, ValueGrid } from "./chart-frame";
import { SeriesBar, SeriesLegend, SeriesLine, SeriesPoint } from "./series-marks";

const MIN_LABEL_WIDTH = 30;
const MIN_POINT_LABEL_BAND = 45;
const POINT_RADIUS = 3.5;

function CategoryLabels({ layout, visual }: { layout: ColumnLayout; visual: ChartVisual }) {
  const { lines, step } = layout.labels;

  return visual.categories.map((category, index) => {
    const label = lines[index] ?? [category];
    const x = layout.labelCenters[index] ?? layout.center(index);

    return index % step === 0 ? (
      <text
        className="fill-muted-foreground"
        key={category}
        textAnchor="middle"
        x={x}
        y={HEIGHT - PADDING.bottom + AXIS_LABEL_OFFSET}
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
  textWidth,
  unit,
  visual,
}: {
  layout: ColumnLayout;
  textWidth: TextWidth;
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
        fitsLabel({ label: format(value, { unit: unit ?? undefined }), room: barWidth, textWidth }),
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
  textWidth,
  unit,
  visual,
}: {
  layout: ColumnLayout;
  textWidth: TextWidth;
  unit: string | null;
  visual: ChartVisual;
}) {
  const format = useFormatNumber();

  const showValues =
    visual.series.length === 1 &&
    layout.band >= MIN_POINT_LABEL_BAND &&
    visual.series[0]?.values.every((value) =>
      fitsLabel({
        label: format(value, { unit: unit ?? undefined }),
        room: layout.band,
        textWidth,
      }),
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

function ChartData({ visual }: { visual: ChartVisual }) {
  const format = useFormatNumber();

  return (
    <ScreenReaderData>
      <table>
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
    </ScreenReaderData>
  );
}

export function ChartVisualView({
  className,
  visual,
}: {
  className?: string;
  visual: ChartVisual;
}) {
  const format = useFormatNumber();
  const { boxWidth, ref, scale, width } = useChartSize();
  const textWidth = useTextWidth(ref);
  const { currency, valueLabel } = placeChartUnit(visual);

  const layout = getLayout({
    formatTick: (tick, options) => format(tick, { ...options, unit: currency ?? undefined }),
    formatValue: (value) => format(value, { unit: currency ?? undefined }),
    textWidth,
    visual,
    width,
  });

  const sideways = layout.orientation === "horizontal";
  const chartDraw = visual.chart === "line" ? "point" : "bar";

  return (
    <ChartFigure
      className={className}
      slot="chart-visual"
      source={visual.source}
      title={visual.title}
    >
      <SeriesLegend series={visual.series.map(({ name }) => ({ draw: chartDraw, name }))} />

      <div className="flex flex-col gap-1">
        <p aria-hidden="true" className="text-muted-foreground text-xs">
          {sideways ? visual.categoryLabel : valueLabel}
        </p>

        <ChartDrawing
          boxWidth={boxWidth}
          height={layout.height}
          ref={ref}
          scale={scale}
          width={width}
        >
          {layout.orientation === "horizontal" ? (
            <BarRows layout={layout} unit={currency} visual={visual} />
          ) : (
            <>
              <ValueGrid
                left={layout.left}
                right={width - PADDING.right}
                ticks={layout.yTicks}
                y={layout.y}
              />
              {visual.chart === "bar" ? (
                <Bars layout={layout} textWidth={textWidth} unit={currency} visual={visual} />
              ) : (
                <Lines layout={layout} textWidth={textWidth} unit={currency} visual={visual} />
              )}
              <CategoryLabels layout={layout} visual={visual} />
            </>
          )}
        </ChartDrawing>

        <p aria-hidden="true" className="text-muted-foreground text-xs">
          {sideways ? valueLabel : visual.categoryLabel}
        </p>
      </div>

      <ChartData visual={visual} />
    </ChartFigure>
  );
}

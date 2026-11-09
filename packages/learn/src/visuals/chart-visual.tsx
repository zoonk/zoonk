"use client";

import { type ChartVisual } from "@zoonk/core/library/steps/contract";
import { placeChartUnit } from "@zoonk/core/library/steps/contract/chart-unit";
import { useMeasuredWidth } from "@zoonk/ui/hooks/measured-width";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useFormatNumber } from "../_utils/use-format-number";
import {
  HEIGHT,
  LABEL_GAP,
  LABEL_LINE_HEIGHT,
  type Layout,
  PADDING,
  fitsLabel,
  getChartHeight,
  getLayout,
} from "./_utils/chart-layout";

const FALLBACK_WIDTH = 318;
const GROUP_SHARE = 0.68;
const MIN_LABEL_WIDTH = 30;
const MIN_POINT_LABEL_BAND = 45;
const LABEL_OFFSET = 16;
const DOT_RADIUS = 3.5;

const SERIES_TONES = [
  { fill: "fill-viz-accent", stroke: "stroke-viz-accent", swatch: "bg-viz-accent" },
  { fill: "fill-viz-secondary", stroke: "stroke-viz-secondary", swatch: "bg-viz-secondary" },
  { fill: "fill-viz-highlight", stroke: "stroke-viz-highlight", swatch: "bg-viz-highlight" },
] as const;

function getTone(index: number) {
  return SERIES_TONES[index % SERIES_TONES.length] ?? SERIES_TONES[0];
}

function Grid({ layout, width }: { layout: Layout; width: number }) {
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

function CategoryLabels({ layout, visual }: { layout: Layout; visual: ChartVisual }) {
  const { lines, step } = layout.labels;

  return visual.categories.map((category, index) =>
    index % step === 0 ? (
      <text
        className="fill-muted-foreground"
        key={category}
        textAnchor="middle"
        x={layout.center(index)}
        y={HEIGHT - PADDING.bottom + LABEL_OFFSET}
      >
        {(lines[index] ?? [category]).map((line, lineIndex) => (
          <tspan
            dy={lineIndex === 0 ? 0 : LABEL_LINE_HEIGHT}
            key={`${line}-${String(lineIndex)}`}
            x={layout.center(index)}
          >
            {line}
          </tspan>
        ))}
      </text>
    ) : null,
  );
}

function Bars({
  layout,
  unit,
  visual,
}: {
  layout: Layout;
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
          <rect
            className={getTone(seriesIndex).fill}
            height={Math.max(Math.abs(zero - top), 1)}
            rx={3}
            width={Math.max(barWidth - 2, 1)}
            x={x + 1}
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
  layout: Layout;
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
    const tone = getTone(seriesIndex);

    const points = series.values.map((value, index) => ({
      x: layout.center(index),
      y: layout.y.toPixel(value),
    }));

    return (
      <g key={series.name}>
        <polyline
          className={cn("fill-none stroke-2", tone.stroke)}
          points={points.map((point) => `${point.x},${point.y}`).join(" ")}
          strokeLinejoin="round"
        />
        {points.map((point, index) => {
          const key = `${series.name}-${visual.categories[index] ?? index}`;

          return (
            <g key={key}>
              <circle className={tone.fill} cx={point.x} cy={point.y} r={DOT_RADIUS} />
              {showValues && (
                <text
                  className="fill-foreground font-medium"
                  textAnchor="middle"
                  x={point.x}
                  y={point.y - LABEL_GAP - DOT_RADIUS}
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
          <span className={cn("size-2.5 rounded-sm", getTone(index).swatch)} />
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
  const { ref, width } = useMeasuredWidth<HTMLDivElement>(FALLBACK_WIDTH);
  const { numberUnit, valueLabel } = placeChartUnit(visual);

  const layout = getLayout({
    formatTick: (tick) => format(tick, { compact: true, unit: numberUnit ?? undefined }),
    visual,
    width,
  });

  const height = getChartHeight(layout);

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
          {valueLabel}
        </p>

        <div className="w-full" ref={ref}>
          <svg
            aria-hidden="true"
            className="block overflow-visible text-xs tabular-nums select-none"
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            width={width}
          >
            <Grid layout={layout} width={width} />
            {visual.chart === "bar" ? (
              <Bars layout={layout} unit={numberUnit} visual={visual} />
            ) : (
              <Lines layout={layout} unit={numberUnit} visual={visual} />
            )}
            <CategoryLabels layout={layout} visual={visual} />
          </svg>
        </div>

        <p aria-hidden="true" className="text-muted-foreground text-center text-xs">
          {visual.categoryLabel}
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

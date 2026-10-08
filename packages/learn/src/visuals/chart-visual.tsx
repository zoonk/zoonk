"use client";

import { type ChartVisual } from "@zoonk/core/library/steps/contract";
import { useMeasuredWidth } from "@zoonk/ui/hooks/measured-width";
import { cn } from "@zoonk/ui/lib/utils";
import { createLinearScale, niceDomain, niceTicks } from "@zoonk/utils/plot-scale";
import { useExtracted } from "next-intl";
import { useFormatNumber } from "../_utils/use-format-number";
import { type CategoryLabelLayout, getCategoryLabels } from "./_utils/category-labels";

/** Phone width of the chart, used until its real width is measured. */
const FALLBACK_WIDTH = 318;
const HEIGHT = 208;
const PADDING = { bottom: 26, left: 48, right: 8, top: 22 } as const;
const TICK_COUNT = 4;
/** Bars fill this share of their category's band; the rest is the gap between categories. */
const GROUP_SHARE = 0.68;
/** A value label fits over a bar this wide, so tight charts leave them out. */
const MIN_LABEL_WIDTH = 30;
/** Points of a line sit closer to their neighbors' labels than bars do, so they need more room. */
const MIN_POINT_LABEL_BAND = 45;
const LABEL_GAP = 6;
const LABEL_LINE_HEIGHT = 14;
/** From the plot's bottom edge to the baseline of the category labels' first line. */
const LABEL_OFFSET = 16;
const DOT_RADIUS = 3.5;

/** One color per series, the same three the activities use, readable in light and dark. */
const SERIES_TONES = [
  { fill: "fill-viz-accent", stroke: "stroke-viz-accent", swatch: "bg-viz-accent" },
  { fill: "fill-viz-secondary", stroke: "stroke-viz-secondary", swatch: "bg-viz-secondary" },
  { fill: "fill-viz-highlight", stroke: "stroke-viz-highlight", swatch: "bg-viz-highlight" },
] as const;

function getTone(index: number) {
  return SERIES_TONES[index % SERIES_TONES.length] ?? SERIES_TONES[0];
}

type Layout = {
  band: number;
  center: (index: number) => number;
  labels: CategoryLabelLayout;
  y: ReturnType<typeof createLinearScale>;
  yTicks: number[];
};

function getLayout({ visual, width }: { visual: ChartVisual; width: number }): Layout {
  const values = visual.series.flatMap((series) => series.values);
  const anchors = visual.axisStart === null ? values : [...values, visual.axisStart];
  const nice = niceDomain(anchors, { includeZero: visual.chart === "bar" });

  // A screen about a cropped axis starts it where the data says, as the chart it discusses does.
  const yDomain = visual.axisStart === null ? nice : ([visual.axisStart, nice[1]] as const);
  const plotWidth = Math.max(width - PADDING.left - PADDING.right, 1);
  const band = plotWidth / visual.categories.length;

  // Counts read as whole numbers, so their axis skips ticks like 2.5.
  const wholeNumbers = values.every((value) => Number.isInteger(value));

  return {
    band,
    center: (index) => PADDING.left + band * index + band / 2,
    labels: getCategoryLabels({ band, categories: visual.categories }),
    y: createLinearScale({ domain: yDomain, range: [HEIGHT - PADDING.bottom, PADDING.top] }),
    yTicks: niceTicks(yDomain, TICK_COUNT).filter(
      (tick) => !wholeNumbers || Number.isInteger(tick),
    ),
  };
}

/** The chart's height with room for category labels that take two lines. */
function getChartHeight(layout: Layout): number {
  const lines = Math.max(...layout.labels.lines.map((label) => label.length));
  return HEIGHT + (lines - 1) * LABEL_LINE_HEIGHT;
}

function Grid({ layout, unit, width }: { layout: Layout; unit: string | null; width: number }) {
  const format = useFormatNumber();

  return layout.yTicks.map((tick) => {
    const y = layout.y.toPixel(tick);

    return (
      <g key={tick}>
        <line
          className="stroke-border"
          x1={PADDING.left}
          x2={width - PADDING.right}
          y1={y}
          y2={y}
        />
        <text
          className="fill-muted-foreground"
          dominantBaseline="middle"
          textAnchor="end"
          x={PADDING.left - LABEL_GAP}
          y={y}
        >
          {format(tick, { compact: true, unit: unit ?? undefined })}
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
          <tspan dy={lineIndex === 0 ? 0 : LABEL_LINE_HEIGHT} key={line} x={layout.center(index)}>
            {line}
          </tspan>
        ))}
      </text>
    ) : null,
  );
}

function Bars({ layout, visual }: { layout: Layout; visual: ChartVisual }) {
  const format = useFormatNumber();
  const group = layout.band * GROUP_SHARE;
  const barWidth = group / visual.series.length;
  const zero = layout.y.toPixel(Math.max(layout.y.domain[0], 0));
  const showValues = barWidth >= MIN_LABEL_WIDTH;

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
              {format(value, { unit: visual.unit ?? undefined })}
            </text>
          )}
        </g>
      );
    }),
  );
}

function Lines({ layout, visual }: { layout: Layout; visual: ChartVisual }) {
  const format = useFormatNumber();
  const showValues = visual.series.length === 1 && layout.band >= MIN_POINT_LABEL_BAND;

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
                  {format(series.values[index] ?? 0, { unit: visual.unit ?? undefined })}
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

/** The chart's numbers as a table for screen readers, so every value is read exactly. */
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

/**
 * A bar or line chart drawn from its data at its real width, so labels stay 12px on a phone and a
 * laptop. Bars and points carry their values when there's room, since questions ask about exact
 * numbers; screen readers get the same numbers as a table.
 */
export function ChartVisualView({
  className,
  visual,
}: {
  className?: string;
  visual: ChartVisual;
}) {
  const t = useExtracted();
  const { ref, width } = useMeasuredWidth<HTMLDivElement>(FALLBACK_WIDTH);
  const layout = getLayout({ visual, width });
  const height = getChartHeight(layout);

  return (
    <figure
      className={cn("bg-card flex w-full flex-col gap-3 rounded-2xl border p-4", className)}
      data-slot="chart-visual"
    >
      <figcaption className="text-foreground text-sm font-semibold text-balance">
        {visual.title}
      </figcaption>

      <Legend visual={visual} />

      <div className="flex flex-col gap-1">
        <p aria-hidden="true" className="text-muted-foreground text-xs">
          {visual.valueLabel}
        </p>

        <div className="w-full" ref={ref}>
          <svg
            aria-hidden="true"
            className="block overflow-visible text-xs tabular-nums"
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            width={width}
          >
            <Grid layout={layout} unit={visual.unit} width={width} />
            {visual.chart === "bar" ? (
              <Bars layout={layout} visual={visual} />
            ) : (
              <Lines layout={layout} visual={visual} />
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

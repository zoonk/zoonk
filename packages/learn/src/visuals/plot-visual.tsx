"use client";

import { type PlotVisual } from "@zoonk/core/library/steps/contract";
import { placeChartUnit } from "@zoonk/core/library/steps/contract/chart-unit";
import { isLarge } from "@zoonk/utils/plot-scale";
import { useExtracted } from "next-intl";
import { useAppLocale } from "../_utils/locale";
import { useFormatNumber } from "../_utils/use-format-number";
import { HEIGHT, LABEL_LINE_HEIGHT } from "./_utils/chart-layout";
import { type PlotLayout, drawsDot, getPlotLayout, getPlotTextScale } from "./_utils/plot-layout";
import { getSeriesMark } from "./_utils/series-marks";
import { useChartSize } from "./_utils/use-chart-size";
import { useTextWidth } from "./_utils/use-text-width";
import { ChartDrawing, ChartFigure, ScreenReaderData, ValueGrid } from "./chart-frame";
import { SeriesLegend, SeriesLine, SeriesPoint } from "./series-marks";

const REFERENCE_DASH = "4 4";
const HALO_WIDTH = 3;

function XTicks({ layout }: { layout: PlotLayout }) {
  return layout.xTicks.map((tick) => (
    <text
      className="fill-muted-foreground"
      key={tick.value}
      textAnchor="middle"
      x={tick.center}
      y={layout.xTickY}
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
            x={reference.x}
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
      className="fill-foreground stroke-card font-medium [paint-order:stroke]"
      dominantBaseline="middle"
      key={`${label.text}-${String(label.x)}-${String(label.y)}`}
      strokeLinejoin="round"
      strokeWidth={HALO_WIDTH}
      textAnchor={label.anchor}
      x={label.x}
      y={label.y}
    >
      {label.text}
    </text>
  ));
}

function PlotKey({ layout }: { layout: PlotLayout }) {
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
    <ScreenReaderData>
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
    </ScreenReaderData>
  );
}

export function PlotVisualView({ className, visual }: { className?: string; visual: PlotVisual }) {
  const locale = useAppLocale();
  const { boxWidth, ref, scale: textScale } = useChartSize();
  const textWidth = useTextWidth(ref);
  const scale = getPlotTextScale({ boxWidth, locale, textScale, textWidth, visual });
  const width = boxWidth / scale;
  const layout = getPlotLayout({ locale, textWidth, visual, width });
  const groupX = isLarge(visual.series.flatMap((series) => series.points.map((point) => point.x)));

  return (
    <ChartFigure
      className={className}
      slot="plot-visual"
      source={visual.source}
      title={visual.title}
    >
      <PlotData groupX={groupX} layout={layout} visual={visual} />

      <SeriesLegend
        series={visual.series.map((series) => ({
          draw: series.mark === "points" ? "point" : "line",
          name: series.name,
        }))}
      />

      <div aria-hidden="true" className="flex flex-col gap-1">
        <p className="text-muted-foreground text-xs">
          {placeChartUnit({ label: visual.yLabel, unit: visual.yUnit }).label}
        </p>

        <ChartDrawing boxWidth={boxWidth} height={HEIGHT} ref={ref} scale={scale} width={width}>
          <ValueGrid
            left={layout.left}
            right={layout.plotRight}
            ticks={layout.yTicks}
            y={layout.y}
          />
          <References layout={layout} />
          <Series layout={layout} visual={visual} />
          <PointLabels layout={layout} />
          <XTicks layout={layout} />
        </ChartDrawing>

        <p className="text-muted-foreground text-xs">
          {placeChartUnit({ label: visual.xLabel, unit: visual.xUnit }).label}
        </p>
      </div>

      <PlotKey layout={layout} />
    </ChartFigure>
  );
}

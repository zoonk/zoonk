import { type ChartVisual } from "@zoonk/core/library/steps/contract";
import { useFormatNumber } from "../_utils/use-format-number";
import { clampLabelCenter } from "./_utils/category-labels";
import { BAR_THICKNESS, LABEL_LINE_HEIGHT, type RowLayout, VALUE_GAP } from "./_utils/chart-layout";
import { getSeriesMark } from "./_utils/series-marks";
import { SeriesBar } from "./series-marks";

function ValueTicks({ layout, width }: { layout: RowLayout; width: number }) {
  return layout.xTicks.map((tick) => {
    const x = layout.x.toPixel(tick.value);

    return (
      <g key={tick.value}>
        <line
          className="stroke-viz-grid"
          x1={x}
          x2={x}
          y1={layout.gridTop}
          y2={layout.gridBottom}
        />
        <text
          className="fill-muted-foreground"
          dominantBaseline="middle"
          textAnchor="middle"
          x={clampLabelCenter({ lines: [tick.label], width, x })}
          y={layout.tickY}
        >
          {tick.label}
        </text>
      </g>
    );
  });
}

function RowBar({
  layout,
  seriesIndex,
  top,
  unit,
  value,
}: {
  layout: RowLayout;
  seriesIndex: number;
  top: number;
  unit: string | null;
  value: number;
}) {
  const format = useFormatNumber();
  const origin = layout.x.toPixel(layout.origin);
  const end = layout.x.toPixel(value);
  const negative = value < layout.origin;

  return (
    <g>
      <SeriesBar
        height={BAR_THICKNESS}
        mark={getSeriesMark(seriesIndex)}
        width={Math.max(Math.abs(end - origin), 1)}
        x={Math.min(origin, end)}
        y={top}
      />
      {layout.showValues && (
        <text
          className="fill-foreground font-medium"
          dominantBaseline="middle"
          textAnchor={negative ? "end" : "start"}
          x={negative ? end - VALUE_GAP : end + VALUE_GAP}
          y={top + BAR_THICKNESS / 2}
        >
          {format(value, { unit: unit ?? undefined })}
        </text>
      )}
    </g>
  );
}

export function BarRows({
  layout,
  unit,
  visual,
  width,
}: {
  layout: RowLayout;
  unit: string | null;
  visual: ChartVisual;
  width: number;
}) {
  return (
    <>
      <ValueTicks layout={layout} width={width} />
      {layout.rows.map((row, index) => (
        <g key={row.name}>
          <text className="fill-muted-foreground" dominantBaseline="middle" x={0}>
            {row.lines.map((line, lineIndex) => (
              <tspan
                key={`${line}-${String(lineIndex)}`}
                x={0}
                y={row.nameTop + LABEL_LINE_HEIGHT * lineIndex + LABEL_LINE_HEIGHT / 2}
              >
                {line}
              </tspan>
            ))}
          </text>
          {visual.series.map((series, seriesIndex) => (
            <RowBar
              key={series.name}
              layout={layout}
              seriesIndex={seriesIndex}
              top={row.barTops[seriesIndex] ?? row.nameTop}
              unit={unit}
              value={series.values[index] ?? 0}
            />
          ))}
        </g>
      ))}
    </>
  );
}

"use client";

import { useFormatNumber } from "@zoonk/learn/format-number";
import { cn } from "@zoonk/ui/lib/utils";
import { type LinearScale } from "@zoonk/utils/plot-scale";
import { useExtracted } from "next-intl";
import { ActivityPlaceHandle } from "../_components/activity-place-handle";
import { usePlotScales } from "../_components/activity-plot";
import { cutsToParts, moveCut } from "./area-model-cuts";

export type SideCuts = { cuts: number[]; step: number; total: number };

const GAP = 2;
const EDGE_LABEL_GAP = 10;
const PILL_LONG = 26;
const PILL_SHORT = 12;
const BIG_CELL = 64;
const MEDIUM_CELL = 36;
const MIN_LABEL_CELL = 20;

const CELL_TONES = ["fill-viz-accent-soft", "fill-viz-accent/25", "fill-viz-accent/40"] as const;

/** Pixel edges of every part along one side. */
function edgesOf(side: SideCuts, scale: LinearScale): number[] {
  return [0, ...side.cuts, side.total].map((edge) => scale.toPixel(edge));
}

function cellTextClass(width: number, height: number): string {
  const size = Math.min(width, height);

  if (size >= BIG_CELL) {
    return "text-2xl";
  }

  return size >= MEDIUM_CELL ? "text-base" : "text-xs";
}

/** A pill on the rectangle's edge (or at `cross`, across the side) that moves one split line. */
export function CutHandle({
  cross,
  cut,
  disabled,
  index,
  onCut,
  orientation,
  side,
}: {
  cross?: number;
  cut: number;
  disabled: boolean;
  index: number;
  onCut: (cuts: number[]) => void;
  orientation: "horizontal" | "vertical";
  side: SideCuts;
}) {
  const t = useExtracted();
  const format = useFormatNumber();
  const { x, y } = usePlotScales();
  const scale = orientation === "horizontal" ? x : y;

  const [cx, cy] =
    orientation === "horizontal"
      ? [x.toPixel(cut), cross ?? y.range[1]]
      : [cross ?? x.range[0], y.toPixel(cut)];

  const [width, height] =
    orientation === "horizontal" ? [PILL_SHORT, PILL_LONG] : [PILL_LONG, PILL_SHORT];

  const range = {
    max: (side.cuts[index + 1] ?? side.total) - side.step,
    min: (side.cuts[index - 1] ?? 0) + side.step,
    step: side.step,
  };

  const parts = cutsToParts(side.cuts, side.total);

  return (
    <ActivityPlaceHandle
      cx={cx}
      cy={cy}
      disabled={disabled}
      label={
        orientation === "horizontal" ? t("Split across the width") : t("Split across the height")
      }
      onChange={(value) =>
        onCut(moveCut({ cuts: side.cuts, index, step: side.step, total: side.total, value }))
      }
      orientation={orientation}
      range={range}
      scale={scale}
      value={cut}
      valueText={parts.map((part) => format(part)).join(" + ")}
    >
      <rect
        className={cn("fill-background stroke-muted-foreground", disabled && "opacity-0")}
        height={height}
        rx={PILL_SHORT / 2}
        width={width}
        x={cx - width / 2}
        y={cy - height / 2}
      />
    </ActivityPlaceHandle>
  );
}

function EdgeLabels({
  side,
  orientation,
}: {
  orientation: "horizontal" | "vertical";
  side: SideCuts;
}) {
  const format = useFormatNumber();
  const { x, y } = usePlotScales();
  const scale = orientation === "horizontal" ? x : y;
  const edges = edgesOf(side, scale);

  return (
    <g aria-hidden="true" className="fill-foreground text-sm font-semibold tabular-nums">
      {cutsToParts(side.cuts, side.total).map((part, index) => {
        const middle = ((edges[index] ?? 0) + (edges[index + 1] ?? 0)) / 2;

        return orientation === "horizontal" ? (
          <text
            // oxlint-disable-next-line react/no-array-index-key -- Parts are positional
            key={index}
            textAnchor="middle"
            x={middle}
            y={y.range[1] - EDGE_LABEL_GAP - PILL_LONG / 2}
          >
            {format(part)}
          </text>
        ) : (
          <text
            dominantBaseline="middle"
            // oxlint-disable-next-line react/no-array-index-key -- Parts are positional
            key={index}
            textAnchor="end"
            x={x.range[0] - EDGE_LABEL_GAP - PILL_SHORT}
            y={middle}
          >
            {format(part)}
          </text>
        );
      })}
    </g>
  );
}

/**
 * The area model: a rectangle cut into columns and rows, each cell showing its product. Split
 * lines move with pills on the top and left edges.
 */
export function AreaGrid({
  disabled,
  height,
  onCut,
  width,
}: {
  disabled: boolean;
  height?: SideCuts;
  onCut: (sideIndex: number, cuts: number[]) => void;
  width?: SideCuts;
}) {
  const format = useFormatNumber();
  const { x, y } = usePlotScales();

  if (!width || !height) {
    return null;
  }

  const [columns, rows] = [edgesOf(width, x), edgesOf(height, y)];

  const [widths, heights] = [
    cutsToParts(width.cuts, width.total),
    cutsToParts(height.cuts, height.total),
  ];

  return (
    <>
      <g aria-hidden="true">
        {heights.map((rowPart, row) =>
          widths.map((columnPart, column) => {
            const [left, right, top, bottom] = [
              columns[column] ?? 0,
              columns[column + 1] ?? 0,
              rows[row] ?? 0,
              rows[row + 1] ?? 0,
            ];

            const [cellWidth, cellHeight] = [right - left - GAP, bottom - top - GAP];
            const showsLabel = cellWidth >= MIN_LABEL_CELL && cellHeight >= MIN_LABEL_CELL;

            return (
              // oxlint-disable-next-line react/no-array-index-key -- Cells are positional
              <g key={`${row}-${column}`}>
                <rect
                  className={CELL_TONES[(row + column) % CELL_TONES.length]}
                  height={Math.max(cellHeight, 1)}
                  rx={6}
                  width={Math.max(cellWidth, 1)}
                  x={left + GAP / 2}
                  y={top + GAP / 2}
                />
                {showsLabel && (
                  <text
                    className={cn(
                      "fill-foreground font-bold tabular-nums",
                      cellTextClass(cellWidth, cellHeight),
                    )}
                    dominantBaseline="middle"
                    textAnchor="middle"
                    x={(left + right) / 2}
                    y={(top + bottom) / 2}
                  >
                    {format(columnPart * rowPart)}
                  </text>
                )}
              </g>
            );
          }),
        )}
      </g>

      <EdgeLabels orientation="horizontal" side={width} />
      <EdgeLabels orientation="vertical" side={height} />

      {width.cuts.map((cut, index) => (
        <CutHandle
          cut={cut}
          disabled={disabled}
          index={index}
          // oxlint-disable-next-line react/no-array-index-key -- Cuts are positional
          key={`w-${index}`}
          onCut={(cuts) => onCut(0, cuts)}
          orientation="horizontal"
          side={width}
        />
      ))}

      {height.cuts.map((cut, index) => (
        <CutHandle
          cut={cut}
          disabled={disabled}
          index={index}
          // oxlint-disable-next-line react/no-array-index-key -- Cuts are positional
          key={`h-${index}`}
          onCut={(cuts) => onCut(1, cuts)}
          orientation="vertical"
          side={height}
        />
      ))}
    </>
  );
}

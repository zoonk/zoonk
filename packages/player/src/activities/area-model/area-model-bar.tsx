"use client";

import { useFormatNumber } from "@zoonk/learn/format-number";
import { usePlotScales } from "../_components/activity-plot";
import { cutsToParts } from "./area-model-cuts";
import { CutHandle, type SideCuts } from "./area-model-grid";

const BAR_THICKNESS = 48;
const BRACKET_GAP = 12;
const BRACKET_TICK = 6;
const GAP = 2;
const MIN_LABEL_WIDTH = 28;

const PART_TONES = [
  "fill-viz-accent-soft",
  "fill-viz-highlight-soft",
  "fill-viz-secondary-soft",
] as const;

/**
 * The bar model: one bar for the whole, cut into parts that show their size, with the total
 * bracketed above it.
 */
export function BarModel({
  bar,
  disabled,
  onCut,
}: {
  bar?: SideCuts;
  disabled: boolean;
  onCut: (sideIndex: number, cuts: number[]) => void;
}) {
  const format = useFormatNumber();
  const { x, y } = usePlotScales();

  if (!bar) {
    return null;
  }

  const top = y.range[1];
  const [left, right] = [x.toPixel(0), x.toPixel(bar.total)];
  const edges = [0, ...bar.cuts, bar.total].map((edge) => x.toPixel(edge));
  const bracketY = top - BRACKET_GAP;

  return (
    <>
      <g aria-hidden="true" className="tabular-nums">
        <path
          className="stroke-muted-foreground fill-none"
          d={`M${left} ${bracketY + BRACKET_TICK} V${bracketY} H${right} V${bracketY + BRACKET_TICK}`}
          strokeWidth={1.5}
        />
        <text
          className="fill-foreground text-sm font-semibold"
          textAnchor="middle"
          x={(left + right) / 2}
          y={bracketY - BRACKET_TICK}
        >
          {format(bar.total)}
        </text>

        {cutsToParts(bar.cuts, bar.total).map((part, index) => {
          const [start, end] = [edges[index] ?? left, edges[index + 1] ?? right];

          return (
            // oxlint-disable-next-line react/no-array-index-key -- Parts are positional
            <g key={index}>
              <rect
                className={PART_TONES[index % PART_TONES.length]}
                height={BAR_THICKNESS}
                rx={8}
                width={Math.max(end - start - GAP, 1)}
                x={start + GAP / 2}
                y={top}
              />
              {end - start >= MIN_LABEL_WIDTH && (
                <text
                  className="fill-foreground text-sm font-semibold"
                  dominantBaseline="middle"
                  textAnchor="middle"
                  x={(start + end) / 2}
                  y={top + BAR_THICKNESS / 2}
                >
                  {format(part)}
                </text>
              )}
            </g>
          );
        })}
      </g>

      {bar.cuts.map((cut, index) => (
        <CutHandle
          cross={top + BAR_THICKNESS / 2}
          cut={cut}
          disabled={disabled}
          index={index}
          // oxlint-disable-next-line react/no-array-index-key -- Cuts are positional
          key={index}
          onCut={(cuts) => onCut(0, cuts)}
          orientation="horizontal"
          side={bar}
        />
      ))}
    </>
  );
}

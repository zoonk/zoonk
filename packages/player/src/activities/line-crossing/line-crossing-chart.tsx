"use client";

import { createLinearScale } from "@zoonk/utils/plot-scale";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { ActivityPlaceHandle } from "../_components/activity-place-handle";
import { ActivityPlot, usePlotScales } from "../_components/activity-plot";
import { Axes, ChangeArrows, ClipArea, Crossing, LineLabel, LineMark } from "./line-crossing-marks";
import {
  type Line,
  type LineOffsets,
  type Point,
  type ShiftAxis,
  chartDomain,
  crossingPoint,
  movedLine,
  pointAlong,
  shiftRange,
} from "./line-crossing-model";

type ChartLine = Line & { id: string; label: string };

const PLOT_HEIGHT = 248;
const PADDING = { bottom: 30, left: 22, right: 18, top: 26 };
const HANDLE_RADIUS = 14;
const CHEVRON = 4;

/**
 * Where each line's handle sits along its visible stretch: toward the right end, away from where
 * the lines cross, so the handles never cover the crossing.
 */
const HANDLE_SHARE = 0.82;

/** The first line in the highlight color, the second in the secondary one. */
const LINE_CLASSES = ["stroke-viz-highlight", "stroke-viz-secondary"] as const;
const LINE_TEXT_CLASSES = ["text-viz-highlight", "text-viz-secondary"] as const;

/** Two chevrons pointing the ways a handle moves: sideways, or up and down. */
function chevrons({ axis, cx, cy }: { axis: ShiftAxis; cx: number; cy: number }): string {
  return axis === "horizontal"
    ? `M${cx - 2} ${cy - CHEVRON} l-${CHEVRON} ${CHEVRON} l${CHEVRON} ${CHEVRON} M${cx + 2} ${cy - CHEVRON} l${CHEVRON} ${CHEVRON} l-${CHEVRON} ${CHEVRON}`
    : `M${cx - CHEVRON} ${cy - 2} l${CHEVRON} -${CHEVRON} l${CHEVRON} ${CHEVRON} M${cx - CHEVRON} ${cy + 2} l${CHEVRON} ${CHEVRON} l${CHEVRON} -${CHEVRON}`;
}

/** A line's drag handle: a slider for keyboards, a 44px drag target for pointers. */
function LineHandle({
  amount,
  axis,
  className,
  disabled,
  domain,
  label,
  line,
  offset,
  onChange,
  valueText,
}: {
  amount: number;
  axis: ShiftAxis;
  className: string;
  disabled: boolean;
  domain: Point;
  label: string;
  line: Line;
  offset: number;
  onChange: (offset: number) => void;
  valueText: string;
}) {
  const scales = usePlotScales();
  const range = shiftRange(amount);
  const home = pointAlong(line, domain, HANDLE_SHARE);
  const isSideways = axis === "horizontal";
  const along = isSideways ? scales.x : scales.y;
  const start = isSideways ? home.x : home.y;

  const scale = createLinearScale({
    domain: [range.min, range.max],
    range: [along.toPixel(start + range.min), along.toPixel(start + range.max)],
  });

  const [cx, cy] = isSideways
    ? [scale.toPixel(offset), scales.y.toPixel(home.y)]
    : [scales.x.toPixel(home.x), scale.toPixel(offset)];

  return (
    <ActivityPlaceHandle
      className={className}
      cx={cx}
      cy={cy}
      disabled={disabled}
      label={label}
      onChange={onChange}
      orientation={axis}
      range={range}
      scale={scale}
      value={offset}
      valueText={valueText}
    >
      <circle
        className="fill-background stroke-current"
        cx={cx}
        cy={cy}
        r={HANDLE_RADIUS}
        strokeWidth={2.5}
      />
      <path
        className="fill-none stroke-current"
        d={chevrons({ axis, cx, cy })}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </ActivityPlaceHandle>
  );
}

/**
 * Two straight lines the learner drags by their handles, left and right or up and down as the
 * real change moved one. A moved line's starting place stays dashed, both crossings are marked,
 * and arrows on the axes show what the move did. After the check, the real shift is drawn too.
 */
export function LineCrossingChart({
  amount,
  answerLine,
  axis,
  handleText,
  isChecked,
  lines,
  offsets,
  onMove,
  xLabel,
  yLabel,
}: {
  amount: number;
  /** The line where it really moved, drawn after the check when the learner's move differs. */
  answerLine: Line | null;
  axis: ShiftAxis;
  handleText: (line: ChartLine) => { label: string; valueText: string };
  isChecked: boolean;
  lines: readonly [ChartLine, ChartLine];
  offsets: LineOffsets;
  onMove: (id: string, offset: number) => void;
  xLabel: string;
  yLabel: string;
}) {
  const t = useExtracted();
  const clipId = useId();
  const domain = chartDomain({ amount, axis, lines });
  const offsetOf = (line: ChartLine) => offsets[line.id] ?? 0;
  const shown = lines.map((line) => movedLine(line, offsetOf(line), axis));
  const moved = lines.filter((line) => offsetOf(line) !== 0);
  const before = crossingPoint(lines[0], lines[1]);
  const [first, second] = shown;
  const after = first && second ? crossingPoint(first, second) : before;

  return (
    <ActivityPlot
      height={PLOT_HEIGHT}
      padding={PADDING}
      xDomain={[0, domain.x]}
      yDomain={[0, domain.y]}
    >
      <ClipArea id={clipId} />
      <Axes xLabel={xLabel} yLabel={yLabel} />

      <g clipPath={`url(#${clipId})`}>
        {moved.map((line) => (
          <LineMark
            className="stroke-muted-foreground"
            domain={domain}
            isDashed
            key={`${line.id}-before`}
            line={line}
          />
        ))}

        {answerLine && (
          <LineMark className="stroke-success" domain={domain} isDashed line={answerLine} />
        )}

        {shown.map((line, index) => (
          <LineMark
            className={LINE_CLASSES[index] ?? ""}
            domain={domain}
            key={lines[index]?.id}
            line={line}
          />
        ))}
      </g>

      {moved.map((line) => (
        <LineLabel
          className="text-muted-foreground"
          domain={domain}
          end="lower"
          key={`${line.id}-before`}
          label={t("Before")}
          line={line}
        />
      ))}

      {answerLine && (
        <LineLabel
          className="text-success-text"
          domain={domain}
          end="lower"
          label={t("What happened")}
          line={answerLine}
        />
      )}

      {shown.map((line, index) => (
        <LineLabel
          className={LINE_TEXT_CLASSES[index] ?? ""}
          domain={domain}
          end="upper"
          key={lines[index]?.id}
          label={lines[index]?.label ?? ""}
          line={line}
        />
      ))}

      {moved.length > 0 && (
        <>
          <Crossing isBefore point={before} />
          <ChangeArrows after={after} before={before} />
        </>
      )}

      <Crossing isBefore={false} point={after} />

      {lines.map((line, index) => (
        <LineHandle
          amount={amount}
          axis={axis}
          className={LINE_TEXT_CLASSES[index] ?? ""}
          disabled={isChecked}
          domain={domain}
          key={line.id}
          line={line}
          offset={offsetOf(line)}
          onChange={(offset) => onMove(line.id, offset)}
          {...handleText(line)}
        />
      ))}
    </ActivityPlot>
  );
}

"use client";

import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { ActivityPlot, usePlotScales } from "../_components/activity-plot";
import { HANDLE_RADIUS, HANDLE_STROKE, LineHandle } from "./line-crossing-handle";
import { type LabelSize, placeLineLabels } from "./line-crossing-labels";
import {
  Axes,
  CROSSING_RADIUS,
  ChangeArrows,
  ClipArea,
  Crossing,
  LineLabel,
  LineMark,
  changeArrowBoxes,
} from "./line-crossing-marks";
import {
  type Line,
  type LineOffsets,
  type LineSlide,
  type Point,
  type ShiftAxis,
  chartDomain,
  crossingPoint,
  lineSlide,
  movedLine,
  visibleSegment,
} from "./line-crossing-model";

type ChartLine = Line & { id: string; label: string };

const PLOT_HEIGHT = 248;
const PADDING = { bottom: 30, left: 22, right: 18, top: 26 };
const LINE_CLASSES = ["stroke-viz-highlight", "stroke-viz-secondary"] as const;
const LINE_TEXT_CLASSES = ["text-viz-highlight", "text-viz-secondary"] as const;

type ChartLabel = { className: string; id: string; isUpper: boolean; label: string; line: Line };

type LineAndSlide = { line: ChartLine; slide: LineSlide };

function LineLabels({
  answerLine,
  axis,
  crossings,
  domain,
  lines,
  offsets,
  slides,
}: {
  answerLine: Line | null;
  axis: ShiftAxis;
  crossings: { after: Point; before: Point | null };
  domain: Point;
  lines: readonly [ChartLine, ChartLine];
  offsets: LineOffsets;
  slides: readonly LineAndSlide[];
}) {
  const t = useExtracted();
  const scales = usePlotScales();
  const [sizes, setSizes] = useState<Readonly<Record<string, LabelSize>>>({});
  const offsetOf = (line: ChartLine) => offsets[line.id] ?? 0;
  const pixel = (point: Point) => ({ x: scales.x.toPixel(point.x), y: scales.y.toPixel(point.y) });

  const area = {
    bottom: scales.y.range[0],
    left: scales.x.range[0],
    right: scales.width,
    top: scales.y.range[1],
  };

  const handles = slides.map(({ line, slide }) => {
    const { x, y } = pixel(slide.at(offsetOf(line)));
    return { cx: x, cy: y, radius: HANDLE_RADIUS + HANDLE_STROKE / 2 };
  });

  const dots = [crossings.after, crossings.before].flatMap((point) =>
    point
      ? [{ cx: scales.x.toPixel(point.x), cy: scales.y.toPixel(point.y), radius: CROSSING_RADIUS }]
      : [],
  );

  const marks = {
    arrows: crossings.before
      ? changeArrowBoxes({ after: crossings.after, before: crossings.before, ...scales })
      : [],
    circles: [...handles, ...dots],
  };

  const labels: ChartLabel[] = [
    ...lines.map((line, index) => ({
      className: LINE_TEXT_CLASSES[index] ?? "",
      id: line.id,
      isUpper: true,
      label: line.label,
      line: movedLine(line, offsetOf(line), axis),
    })),
    ...(answerLine
      ? [
          {
            className: "text-success-text",
            id: "answer",
            isUpper: false,
            label: t("What happened"),
            line: answerLine,
          },
        ]
      : []),
    ...lines
      .filter((line) => offsetOf(line) !== 0)
      .map((line) => ({
        className: "text-muted-foreground",
        id: `${line.id}-before`,
        isUpper: false,
        label: t("Before"),
        line,
      })),
  ];

  const measured = labels.flatMap((label) => {
    const size = sizes[label.id];
    const { from, to } = visibleSegment(label.line, domain);

    return size
      ? [{ isUpper: label.isUpper, segment: { from: pixel(from), to: pixel(to) }, size }]
      : [];
  });

  const boxes =
    measured.length === labels.length
      ? placeLineLabels({
          area,
          labels: measured,
          marks: { ...marks, lines: measured.map((label) => label.segment) },
        })
      : [];

  return labels.map((label, index) => (
    <LineLabel
      box={boxes[index] ?? null}
      className={label.className}
      key={label.id}
      label={label.label}
      onMeasure={(size) => setSizes((known) => ({ ...known, [label.id]: size }))}
    />
  ));
}

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
  const clipId = useId();
  const domain = chartDomain({ amount, axis, lines });
  const offsetOf = (line: ChartLine) => offsets[line.id] ?? 0;
  const shown = lines.map((line) => movedLine(line, offsetOf(line), axis));
  const moved = lines.filter((line) => offsetOf(line) !== 0);
  const before = crossingPoint(lines[0], lines[1]);
  const [first, second] = shown;
  const after = first && second ? crossingPoint(first, second) : before;

  const slides = lines.map((line) => ({
    line,
    slide: lineSlide({ amount, axis, crossing: before, domain, line }),
  }));

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

      <LineLabels
        answerLine={answerLine}
        axis={axis}
        crossings={{ after, before: moved.length > 0 ? before : null }}
        domain={domain}
        lines={lines}
        offsets={offsets}
        slides={slides}
      />

      {moved.length > 0 && (
        <>
          <Crossing isBefore point={before} />
          <ChangeArrows after={after} before={before} />
        </>
      )}

      <Crossing isBefore={false} point={after} />

      {slides.map(({ line, slide }, index) => (
        <LineHandle
          axis={axis}
          className={LINE_TEXT_CLASSES[index] ?? ""}
          disabled={isChecked}
          key={line.id}
          offset={offsets[line.id] ?? 0}
          onChange={(offset) => onMove(line.id, offset)}
          slide={slide}
          {...handleText(line)}
        />
      ))}
    </ActivityPlot>
  );
}

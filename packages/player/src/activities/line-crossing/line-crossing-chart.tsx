"use client";

import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { ActivityPlot, usePlotScales } from "../_components/activity-plot";
import { HANDLE_RADIUS, HANDLE_STROKE, LineHandle } from "./line-crossing-handle";
import { type LabelSize, changeArrowBoxes, placeChartLabels } from "./line-crossing-labels";
import {
  Axes,
  CROSSING_RADIUS,
  ChangeArrows,
  ClipArea,
  CrossingDot,
  CrossingGuide,
  LineLabel,
  LineMark,
  yTitleBox,
} from "./line-crossing-marks";
import {
  type ChartDomain,
  type Line,
  type LineOffsets,
  type LineSlide,
  type Point,
  type ShiftAxis,
  chartSlides,
  crossingPoint,
  movedLine,
  visibleSegment,
} from "./line-crossing-model";

type ChartLine = Line & { id: string; label: string };

const PLOT_HEIGHT = 248;
// The axis's stroke starts on the card's text edge and the plot runs to its far edge.
const PADDING = { bottom: 30, left: 1, right: 0, top: 26 };
const LINE_CLASSES = ["stroke-viz-highlight", "stroke-viz-secondary"] as const;
const LINE_TEXT_CLASSES = ["text-viz-highlight", "text-viz-secondary"] as const;

type ChartLabel = {
  className: string;
  id: string;
  isOptional?: boolean;
  isUpper: boolean;
  label: string;
  line: Line;
};

type LineAndSlide = { line: ChartLine; slide: LineSlide };

function LineLabels({
  answerLine,
  axis,
  crossings,
  domain,
  lines,
  offsets,
  slides,
  yLabel,
}: {
  answerLine: Line | null;
  axis: ShiftAxis;
  crossings: { after: Point; before: Point | null };
  domain: ChartDomain;
  lines: readonly [ChartLine, ChartLine];
  offsets: LineOffsets;
  slides: readonly LineAndSlide[];
  yLabel: string;
}) {
  const t = useExtracted();
  const scales = usePlotScales();
  const [sizes, setSizes] = useState<Readonly<Record<string, LabelSize>>>({});
  const offsetOf = (line: ChartLine) => offsets[line.id] ?? 0;
  const pixel = (point: Point) => ({ x: scales.x.toPixel(point.x), y: scales.y.toPixel(point.y) });

  // A line that leaves through the chart's top keeps its name over its end, in the room above the chart.
  const area = {
    bottom: scales.y.range[0],
    left: scales.x.range[0],
    right: scales.x.range[1],
    top: 0,
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
    boxes: [
      yTitleBox({ left: scales.x.range[0], title: yLabel, top: scales.y.range[1] }),
      ...(crossings.before
        ? changeArrowBoxes({
            after: pixel(crossings.after),
            before: pixel(crossings.before),
            bottom: scales.y.range[0],
            left: scales.x.range[0],
          })
        : []),
    ],
    circles: [...handles, ...dots],
  };

  const shown: ChartLabel[] = [
    ...lines.map((line, index) => ({
      className: LINE_TEXT_CLASSES[index] ?? "",
      id: line.id,
      isUpper: true,
      label: line.label,
      line: movedLine(line, offsetOf(line), axis),
    })),
    ...lines
      .filter((line) => offsetOf(line) !== 0)
      .map((line) => ({
        className: "text-muted-foreground",
        id: `${line.id}-before`,
        isOptional: true,
        isUpper: false,
        label: t("Before"),
        line,
      })),
  ];

  const revealed: ChartLabel[] = answerLine
    ? [
        {
          className: "text-success-text",
          id: "answer",
          isUpper: false,
          label: t("What happened"),
          line: answerLine,
        },
      ]
    : [];

  const labels = [...shown, ...revealed];

  const measure = (list: readonly ChartLabel[]) =>
    list.flatMap((label) => {
      const size = sizes[label.id];
      const { from, to } = visibleSegment(label.line, domain);

      return size
        ? [
            {
              isOptional: label.isOptional,
              isUpper: label.isUpper,
              segment: { from: pixel(from), to: pixel(to) },
              size,
            },
          ]
        : [];
    });

  const isMeasured = (list: readonly ChartLabel[]) => list.every((label) => sizes[label.id]);

  // The answer's name is measured once Check shows it; the names already shown keep their spots meanwhile.
  const boxes = isMeasured(shown)
    ? placeChartLabels({
        area,
        marks,
        revealed: isMeasured(revealed) ? measure(revealed) : [],
        shown: measure(shown),
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
  real,
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
  real: LineOffsets;
  xLabel: string;
  yLabel: string;
}) {
  const clipId = useId();
  const { domain, slides } = chartSlides({ amount, axis, lines, real });
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
      xDomain={[domain.min.x, domain.max.x]}
      yDomain={[domain.min.y, domain.max.y]}
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
        yLabel={yLabel}
      />

      {moved.length > 0 && (
        <>
          <CrossingGuide isBefore point={before} />
          <ChangeArrows after={after} before={before} />
        </>
      )}

      <CrossingGuide isBefore={false} point={after} />

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

      {/* The crossings are the answer, so they show over a handle resting on them. */}
      {moved.length > 0 && <CrossingDot isBefore point={before} />}
      <CrossingDot isBefore={false} point={after} />
    </ActivityPlot>
  );
}

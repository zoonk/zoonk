"use client";

import { useFormatNumber } from "@zoonk/learn/format-number";
import { niceTicks } from "@zoonk/utils/plot-scale";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { ActivityPlot, usePlotScales } from "../_components/activity-plot";
import { estimatedLabelWidth } from "../_utils/drawing-label";
import { PLOT_TICK_ROOM, TICK_GAP } from "../_utils/plot-ticks";
import { LineHandle } from "./line-crossing-handle";
import { changeArrowBoxes, placeChartLabels } from "./line-crossing-labels";
import {
  Axes,
  CROSSING_RADIUS,
  ChangeArrows,
  ClipArea,
  CrossingDot,
  CrossingGuide,
  LineLabel,
  type LineLabelMetrics,
  LineMark,
  crossingGuides,
} from "./line-crossing-marks";
import {
  type ChartDomain,
  HANDLE_RADIUS,
  HANDLE_STROKE,
  type Line,
  type LineOffsets,
  type LineSlide,
  type Point,
  type ShiftAxis,
  chartDomain,
  chartSlides,
  crossingPoint,
  movedLine,
  visibleSegment,
} from "./line-crossing-model";

type ChartLine = Line & { id: string; label: string };

const PLOT_HEIGHT = 280;
const PADDING = { bottom: 36, left: PLOT_TICK_ROOM, right: 12, top: 26 };
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
}: {
  answerLine: Line | null;
  axis: ShiftAxis;
  crossings: { after: Point; before: Point | null };
  domain: ChartDomain;
  lines: readonly [ChartLine, ChartLine];
  offsets: LineOffsets;
  slides: readonly LineAndSlide[];
}) {
  const t = useExtracted();
  const scales = usePlotScales();
  const [sizes, setSizes] = useState<Readonly<Record<string, LineLabelMetrics>>>({});
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

  const guideLines = [crossings.after, crossings.before].flatMap((point) =>
    point ? crossingGuides(pixel(point), area.left, area.bottom) : [],
  );

  const segment = (line: Line) => {
    const { from, to } = visibleSegment(line, domain);
    return { from: pixel(from), to: pixel(to) };
  };

  const marks = {
    boxes: [
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
    lines: guideLines,
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

      return size
        ? [
            {
              isOptional: label.isOptional,
              isUpper: label.isUpper,
              segment: segment(label.line),
              size,
            },
          ]
        : [];
    });

  const isMeasured = (list: readonly ChartLabel[]) => list.every((label) => sizes[label.id]);

  const boxes = isMeasured(shown)
    ? placeChartLabels({
        area,
        marks,
        revealed: isMeasured(revealed) ? measure(revealed) : [],
        revealedLine: answerLine ? segment(answerLine) : undefined,
        shown: measure(shown),
      })
    : [];

  return labels.map((label, index) => (
    <LineLabel
      box={boxes[index] ?? null}
      className={label.className}
      key={label.id}
      label={label.label}
      metrics={sizes[label.id]}
      onMeasure={(size) => setSizes((known) => ({ ...known, [label.id]: size }))}
    />
  ));
}

function LineCrossingPlot({
  amount,
  answerLine,
  axis,
  handleText,
  isChecked,
  lines,
  offsets,
  onMove,
  real,
  units,
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
  units: { x?: string; y?: string };
  yLabel: string;
}) {
  const clipId = useId();
  const scales = usePlotScales();

  const { domain, slides, xTicks, yTicks } = chartSlides({
    amount,
    axis,
    lines,
    plot: { x: scales.x.range[1] - scales.x.range[0], y: scales.y.range[0] - scales.y.range[1] },
    real,
  });

  const offsetOf = (line: ChartLine) => offsets[line.id] ?? 0;
  const shown = lines.map((line) => movedLine(line, offsetOf(line), axis));
  const moved = lines.filter((line) => offsetOf(line) !== 0);
  const before = crossingPoint(lines[0], lines[1]);
  const [first, second] = shown;
  const after = first && second ? crossingPoint(first, second) : before;

  return (
    <>
      <ClipArea id={clipId} />
      <Axes units={units} xTicks={xTicks} yTicks={yTicks} />

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
    </>
  );
}

export function LineCrossingChart(props: Parameters<typeof LineCrossingPlot>[0]) {
  const format = useFormatNumber();
  const domain = chartDomain(props);
  const yTicks = niceTicks([domain.min.y, domain.max.y]);

  return (
    <ActivityPlot
      xLabel={props.xLabel}
      yLabel={props.yLabel}
      height={PLOT_HEIGHT}
      padding={{
        ...PADDING,
        left: Math.max(
          PLOT_TICK_ROOM,
          ...yTicks.map(
            (tick) => estimatedLabelWidth(format(tick, { unit: props.units.y })) + TICK_GAP,
          ),
        ),
      }}
      xDomain={[domain.min.x, domain.max.x]}
      yDomain={[domain.min.y, domain.max.y]}
    >
      <LineCrossingPlot {...props} />
    </ActivityPlot>
  );
}

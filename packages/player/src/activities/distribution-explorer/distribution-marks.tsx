"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useLayoutEffect, useRef, useState } from "react";
import { ActivityPlaceHandle } from "../_components/activity-place-handle";
import { usePlotScales } from "../_components/activity-plot";
import { DRAWING_LABEL_HALO, type LabelBox } from "../_utils/drawing-label";
import { type PlotPoint } from "../_utils/sample-formula";
import { type SnapRange } from "../_utils/snap-value";
import { distributionTailBottom } from "./distribution-tail-label";

const PILL_HEIGHT = 26;
const PILL_PADDING = 10;
const CHAR_WIDTH = 8;
const PILL_OFFSET = 18;
const TICK_OFFSET = 18;
const TICK_DROP = 4;
const TARGET_LABEL_RISE = 4;
const TICK_CLEARANCE = 28;
const TAIL_GAP = 6;
const MIN_TAIL_ROOM = 34;

function pillWidth(label: string): number {
  return label.length * CHAR_WIDTH + 2 * PILL_PADDING;
}

export function DistributionHandle({
  disabled,
  label,
  onChange,
  range,
  value,
  valueLabel,
  valueText,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: number) => void;
  range: SnapRange;
  value: number;
  valueLabel: string;
  valueText: string;
}) {
  const { x, y } = usePlotScales();
  const [bottom, top] = y.range;
  const cx = x.toPixel(value);
  const cy = bottom + PILL_OFFSET;
  const width = pillWidth(valueLabel);

  return (
    <ActivityPlaceHandle
      cx={cx}
      cy={cy}
      disabled={disabled}
      label={label}
      onChange={onChange}
      range={range}
      scale={x}
      value={value}
      valueText={valueText}
    >
      <path className="stroke-viz-accent" d={`M${cx} ${top} V${cy}`} strokeWidth={2} />
      <rect
        className="fill-viz-accent stroke-ring stroke-0 group-focus-visible/handle:stroke-3"
        height={PILL_HEIGHT}
        rx={PILL_HEIGHT / 2}
        width={width}
        x={cx - width / 2}
        y={cy - PILL_HEIGHT / 2}
      />
      <text
        className="fill-background text-compact font-semibold tabular-nums"
        dominantBaseline="central"
        textAnchor="middle"
        x={cx}
        y={cy}
      >
        {valueLabel}
      </text>
    </ActivityPlaceHandle>
  );
}

export function DistributionTicks({
  format,
  handles,
  ticks,
}: {
  format: (value: number) => string;
  handles: readonly number[];
  ticks: readonly number[];
}) {
  const { x, y } = usePlotScales();
  const [bottom] = y.range;
  const [left, right] = x.range;

  const visible = ticks.filter((tick) =>
    handles.every((handle) => Math.abs(x.toPixel(tick) - x.toPixel(handle)) >= TICK_CLEARANCE),
  );

  return (
    <g aria-hidden="true" data-slot="distribution-ticks">
      <path className="stroke-viz-grid" d={`M${left} ${bottom} H${right}`} strokeWidth={1.5} />
      {visible.map((tick) => (
        <text
          className="fill-muted-foreground"
          key={tick}
          textAnchor="middle"
          x={x.toPixel(tick)}
          y={bottom + TICK_OFFSET + TICK_DROP}
        >
          {format(tick)}
        </text>
      ))}
    </g>
  );
}

export function DistributionLabels({
  below,
  above,
  curve,
  handles,
  target,
}: {
  target?: { from: number; to: number; label: string };
  above: string;
  below: string;
  curve: readonly PlotPoint[];
  handles: readonly [number, number];
}) {
  const { x, y } = usePlotScales();
  const [bottom, top] = y.range;
  const [left, right] = x.range;
  const [from, to] = [x.toPixel(handles[0]), x.toPixel(handles[1])];
  const targetRef = useRef<SVGTextElement>(null);
  const belowRef = useRef<SVGTextElement>(null);
  const aboveRef = useRef<SVGTextElement>(null);

  const layout = [
    above,
    below,
    target?.label,
    target?.from,
    target?.to,
    from,
    to,
    left,
    right,
    top,
    bottom,
  ].join("\n");

  const [drawn, setDrawn] = useState<{
    layout: string;
    target?: LabelBox;
    obstacles: LabelBox[];
    below: { width: number; height: number };
    above: { width: number; height: number };
  }>({ above: { height: 0, width: 0 }, below: { height: 0, width: 0 }, layout: "", obstacles: [] });

  useLayoutEffect(() => {
    const svg = belowRef.current?.ownerSVGElement ?? aboveRef.current?.ownerSVGElement;

    const obstacles = [
      ...(svg?.querySelectorAll<SVGGraphicsElement>(
        '[data-slot="distribution-ticks"] text, [data-slot="activity-place-handle"] rect, [data-slot="activity-place-handle"] text',
      ) ?? []),
    ];

    const nodes = [targetRef.current, belowRef.current, aboveRef.current, ...obstacles];

    const measure = () => {
      const [targetBox, belowBox, aboveBox] = nodes.map((node) => node?.getBBox());

      setDrawn({
        above: { height: aboveBox?.height ?? 0, width: aboveBox?.width ?? 0 },
        below: { height: belowBox?.height ?? 0, width: belowBox?.width ?? 0 },
        layout,
        obstacles: obstacles.map((node) => {
          const box = node.getBBox();
          return { bottom: box.y + box.height, left: box.x, right: box.x + box.width, top: box.y };
        }),
        target: targetBox
          ? {
              bottom: targetBox.y + targetBox.height,
              left: targetBox.x,
              right: targetBox.x + targetBox.width,
              top: targetBox.y,
            }
          : undefined,
      });
    };

    measure();
    const resizes = new ResizeObserver(measure);

    for (const node of nodes) {
      if (node) {
        resizes.observe(node);
      }
    }

    return () => resizes.disconnect();
  }, [layout]);

  const line = curve.map((point) => ({ x: x.toPixel(point.x), y: y.toPixel(point.y) }));

  const belowY = Math.min(
    bottom,
    ...curve.filter((point) => point.x <= handles[0]).map((point) => y.toPixel(point.y)),
  );

  const aboveY = Math.min(
    bottom,
    ...curve.filter((point) => point.x >= handles[1]).map((point) => y.toPixel(point.y)),
  );

  const placement = {
    curve: line,
    obstacles: drawn.target ? [...drawn.obstacles, drawn.target] : drawn.obstacles,
    plot: { bottom, left, right, top },
  };

  const belowBottom =
    drawn.layout === layout
      ? distributionTailBottom({
          ...placement,
          anchor: "end",
          at: from - TAIL_GAP,
          preferred: belowY - TAIL_GAP,
          size: drawn.below,
        })
      : undefined;

  const aboveBottom =
    drawn.layout === layout
      ? distributionTailBottom({
          ...placement,
          anchor: "start",
          at: to + TAIL_GAP,
          preferred: aboveY - TAIL_GAP,
          size: drawn.above,
        })
      : undefined;

  return (
    <>
      {target && <DistributionTarget label={target.label} ref={targetRef} target={target} />}
      <g aria-hidden="true" className={cn("fill-muted-foreground", DRAWING_LABEL_HALO)}>
        {from - left >= MIN_TAIL_ROOM && (
          <text
            dominantBaseline="text-after-edge"
            ref={belowRef}
            textAnchor="end"
            x={from - TAIL_GAP}
            visibility={belowBottom === undefined ? "hidden" : undefined}
            y={belowBottom ?? 0}
          >
            {below}
          </text>
        )}
        {right - to >= MIN_TAIL_ROOM && (
          <text
            dominantBaseline="text-after-edge"
            ref={aboveRef}
            textAnchor="start"
            x={to + TAIL_GAP}
            visibility={aboveBottom === undefined ? "hidden" : undefined}
            y={aboveBottom ?? 0}
          >
            {above}
          </text>
        )}
      </g>
    </>
  );
}

function DistributionTarget({
  ref,
  label,
  target,
}: {
  ref: React.Ref<SVGTextElement>;
  label: string;
  target: { from: number; to: number };
}) {
  const { x, y } = usePlotScales();
  const [bottom, top] = y.range;
  const [from, to] = [x.toPixel(target.from), x.toPixel(target.to)];

  return (
    <g aria-hidden="true">
      <path
        className="stroke-success"
        d={`M${from} ${bottom} V${top} M${to} ${bottom} V${top}`}
        strokeDasharray="4 3"
        strokeWidth={2}
      />
      <text
        className="fill-success text-xs font-semibold"
        ref={ref}
        textAnchor="middle"
        x={(from + to) / 2}
        y={top - TARGET_LABEL_RISE}
      >
        {label}
      </text>
    </g>
  );
}

export function DistributionMean({ value }: { value: number }) {
  const { x, y } = usePlotScales();
  const [bottom, top] = y.range;

  return (
    <path
      aria-hidden="true"
      className="stroke-muted-foreground/50"
      d={`M${x.toPixel(value)} ${bottom} V${top}`}
      strokeDasharray="3 4"
    />
  );
}

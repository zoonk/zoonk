"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useLayoutEffect, useRef, useState } from "react";
import { DRAWING_LABEL_HALO } from "../_utils/drawing-label";
import {
  type LabelBaseline,
  angleLabelPoint,
  onCircle,
  sinLabelPlacement,
} from "./unit-circle-label";
import { type TrigName } from "./use-unit-circle-format";

type Vector = { x: number; y: number };
type Size = { height: number; width: number };
type DrawnSizes = Record<"angle" | "cos" | "sin", Size>;

const HALF_TURN = 180;
const LABEL_GAP = 8;
const SEGMENT_WIDTH = 4;
const NOTHING: Size = { height: 0, width: 0 };
const NOTHING_DRAWN: DrawnSizes = { angle: NOTHING, cos: NOTHING, sin: NOTHING };

const TRIG_TONES: Record<TrigName, { stroke: string; text: string }> = {
  cos: { stroke: "stroke-viz-secondary", text: "fill-viz-secondary" },
  sin: { stroke: "stroke-viz-highlight", text: "fill-viz-highlight" },
  tan: { stroke: "stroke-viz-accent", text: "fill-viz-accent" },
};

export function arcPath(center: Vector, radius: number, degrees: number): string {
  const end = onCircle(center, radius, degrees);
  const large = degrees > HALF_TURN ? 1 : 0;

  return `M${center.x + radius} ${center.y} A${radius} ${radius} 0 ${large} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export function DialLabel({
  anchor,
  baseline = "middle",
  children,
  className,
  point,
  ref,
}: {
  anchor: "end" | "middle" | "start";
  baseline?: LabelBaseline;
  children: React.ReactNode;
  className?: string;
  point: Vector;
  ref?: React.Ref<SVGTextElement>;
}) {
  return (
    <text
      aria-hidden="true"
      className={cn("text-sm font-semibold tabular-nums", DRAWING_LABEL_HALO, className)}
      dominantBaseline={baseline}
      ref={ref}
      textAnchor={anchor}
      x={point.x}
      y={point.y}
    >
      {children}
    </text>
  );
}

export function TangentMark({
  center,
  formatValue,
  limit,
  name,
  radius,
  value,
}: {
  center: Vector;
  formatValue: (value: number | null) => string;
  limit: number;
  name: string;
  radius: number;
  value: number | null;
}) {
  if (value === null) {
    return null;
  }

  const reach = Math.max(Math.min(-value * radius, limit), -limit);
  const top = { x: center.x + radius, y: center.y + reach };

  return (
    <g aria-hidden="true">
      <path
        className="stroke-viz-accent/60 fill-none"
        d={`M${center.x} ${center.y} L${top.x} ${top.y}`}
        strokeDasharray="3 4"
        strokeWidth={1.5}
      />
      <path
        className={TRIG_TONES.tan.stroke}
        d={`M${top.x} ${center.y} V${top.y}`}
        strokeLinecap="round"
        strokeWidth={SEGMENT_WIDTH}
      />
      <DialLabel
        anchor="end"
        className={TRIG_TONES.tan.text}
        point={{ x: top.x - LABEL_GAP, y: top.y }}
      >
        {`${name} = ${formatValue(value)}`}
      </DialLabel>
    </g>
  );
}

function sizeOf(node: SVGTextElement | null): Size {
  const box = node?.getBBox();
  return box ? { height: box.height, width: box.width } : NOTHING;
}

export function TrigLegsAndAngle({
  angle,
  canvas,
  center,
  formatValue,
  names,
  point,
  radius,
  show,
  target,
  values,
}: {
  angle: { degrees: number; distance: number; label: string };
  canvas: { width: number };
  center: Vector;
  formatValue: (value: number | null) => string;
  names: Record<TrigName, string>;
  point: Vector;
  radius: number;
  show: readonly TrigName[];
  target: Vector | null;
  values: Partial<Record<TrigName, number | null>>;
}) {
  const foot = { x: point.x, y: center.y };
  const isAbove = point.y <= center.y;
  const sinLabel = `${names.sin} = ${formatValue(values.sin ?? null)}`;
  const cosLabel = `${names.cos} = ${formatValue(values.cos ?? null)}`;
  const angleRef = useRef<SVGTextElement>(null);
  const cosRef = useRef<SVGTextElement>(null);
  const sinRef = useRef<SVGTextElement>(null);
  const labels = [angle.label, cosLabel, sinLabel].join("\n");
  const [drawn, setDrawn] = useState({ labels: "", sizes: NOTHING_DRAWN });

  useLayoutEffect(() => {
    const [angleNode, cosNode, sinNode] = [angleRef.current, cosRef.current, sinRef.current];

    const measure = () => {
      setDrawn({
        labels,
        sizes: { angle: sizeOf(angleNode), cos: sizeOf(cosNode), sin: sizeOf(sinNode) },
      });
    };

    measure();

    const resizes = new ResizeObserver(measure);

    for (const node of [angleNode, cosNode, sinNode]) {
      if (node) {
        resizes.observe(node);
      }
    }

    return () => resizes.disconnect();
  }, [labels]);

  const sizes = drawn.labels === labels ? drawn.sizes : NOTHING_DRAWN;

  const sinPlacement = sinLabelPlacement({
    canvas,
    center,
    label: sizes.sin,
    point,
    radius,
    target,
  });

  const cosPoint = {
    x: (center.x + foot.x) / 2,
    y: center.y + (isAbove ? 1 : -1) * (LABEL_GAP * 2),
  };

  const anglePoint = angleLabelPoint({
    center,
    cos: show.includes("cos") ? { point: cosPoint, size: sizes.cos } : null,
    degrees: angle.degrees,
    from: angle.distance,
    radius,
    size: sizes.angle,
  });

  return (
    <g aria-hidden="true">
      {show.includes("cos") && (
        <>
          <path
            className={TRIG_TONES.cos.stroke}
            d={`M${center.x} ${center.y} H${foot.x}`}
            strokeLinecap="round"
            strokeWidth={SEGMENT_WIDTH}
          />
          <DialLabel anchor="middle" className={TRIG_TONES.cos.text} point={cosPoint} ref={cosRef}>
            {cosLabel}
          </DialLabel>
        </>
      )}

      {show.includes("sin") && (
        <>
          <path
            className={TRIG_TONES.sin.stroke}
            d={`M${foot.x} ${foot.y} V${point.y}`}
            strokeLinecap="round"
            strokeWidth={SEGMENT_WIDTH}
          />
          {sinPlacement.baseline !== "middle" && (
            <path
              className="stroke-viz-highlight/60 fill-none"
              d={`M${foot.x} ${(foot.y + point.y) / 2} H${foot.x + (foot.x < center.x ? -1 : 1) * LABEL_GAP * 3} V${sinPlacement.point.y + (isAbove ? LABEL_GAP : -LABEL_GAP)} H${sinPlacement.point.x}`}
              strokeWidth={1.5}
            />
          )}
          <DialLabel
            anchor={sinPlacement.anchor}
            baseline={sinPlacement.baseline}
            className={TRIG_TONES.sin.text}
            point={sinPlacement.point}
            ref={sinRef}
          >
            {sinLabel}
          </DialLabel>
        </>
      )}

      <DialLabel
        anchor="middle"
        className="fill-muted-foreground text-xs"
        point={anglePoint}
        ref={angleRef}
      >
        {angle.label}
      </DialLabel>
    </g>
  );
}

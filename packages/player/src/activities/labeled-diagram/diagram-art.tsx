import { cn } from "@zoonk/ui/lib/utils";
import { DIAGRAM_TONES } from "../_assets/diagrams/diagram-tones";
import { type DiagramShape } from "../_assets/diagrams/diagram-types";
import { type DiagramSlot } from "./labeled-diagram-model";

/** How a part is marked: the spot being filled, or right or wrong after the check. */
export type PartMark = "active" | "correct" | "incorrect";

const LINE_WIDTH = 3;
const AREA_STROKE = 1.5;
const SOFT_STROKE = 1.25;
const HIGHLIGHT_STROKE = 2.5;
const ANCHOR_RADIUS = 2.5;

function shapeClassName(shape: DiagramShape): string {
  const tone = DIAGRAM_TONES[shape.tone];

  switch (shape.kind ?? "area") {
    case "area":
      return cn(tone.area, tone.stroke);
    case "line":
      return cn("fill-none", tone.stroke);
    case "mark":
      return tone.mark;
    case "region":
      return "fill-none stroke-none";
    case "soft":
      return cn(tone.soft, tone.stroke);
    default:
      return tone.area;
  }
}

/** Paths are unique within a drawing once combined with how they're painted. */
function shapeKey(shape: DiagramShape): string {
  return `${shape.kind ?? "area"}:${shape.path}`;
}

function strokeWidth(shape: DiagramShape): number {
  if (shape.kind === "line") {
    return shape.width ?? LINE_WIDTH;
  }

  return shape.kind === "soft" ? SOFT_STROKE : AREA_STROKE;
}

function DiagramPath({ className, shape }: { className?: string; shape: DiagramShape }) {
  return (
    <path
      className={className ?? shapeClassName(shape)}
      d={shape.path}
      strokeDasharray={shape.dashed ? "4 4" : undefined}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth(shape)}
    />
  );
}

/**
 * A part drawn again on top in the mark's color: tinted while it's the spot being filled, only
 * outlined after the check so the drawing keeps its own colors.
 */
function PartHighlight({ mark, shapes }: { mark: PartMark; shapes: readonly DiagramShape[] }) {
  return (
    <g
      className={cn(
        "motion-safe:animate-in motion-safe:fade-in-0",
        mark === "active" && "fill-viz-accent/25 stroke-viz-accent",
        mark === "correct" && "stroke-success fill-transparent",
        mark === "incorrect" && "stroke-destructive fill-transparent",
      )}
    >
      {shapes.map((shape) => (
        <path
          d={shape.path}
          fill={shape.kind === "line" ? "none" : undefined}
          key={shapeKey(shape)}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={
            shape.kind === "line" ? strokeWidth(shape) + HIGHLIGHT_STROKE : HIGHLIGHT_STROKE
          }
        />
      ))}
    </g>
  );
}

/**
 * The drawing itself, with leader lines from offset pins to their parts and the marked parts
 * outlined on top. It's decoration for screen readers: the spots list and the text alternative
 * say what it shows.
 */
export function DiagramArt({
  height,
  marks,
  shapes,
  slots,
  width,
}: {
  height: number;
  marks: ReadonlyMap<string, PartMark>;
  shapes: readonly DiagramShape[];
  slots: readonly DiagramSlot[];
  width: number;
}) {
  const offsetSlots = slots.filter(
    (slot) => slot.pin[0] !== slot.anchor[0] || slot.pin[1] !== slot.anchor[1],
  );

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 size-full"
      viewBox={`0 0 ${width} ${height}`}
    >
      {shapes.map((shape) => (
        <DiagramPath key={shapeKey(shape)} shape={shape} />
      ))}

      {[...marks].map(([partId, mark]) => (
        <PartHighlight
          key={partId}
          mark={mark}
          shapes={shapes.filter((shape) => shape.part === partId)}
        />
      ))}

      {offsetSlots.map((slot) => (
        <g className="fill-foreground stroke-foreground" key={slot.partId}>
          <path d={`M${slot.pin.join(" ")} L${slot.anchor.join(" ")}`} strokeWidth={1.25} />
          <circle cx={slot.anchor[0]} cy={slot.anchor[1]} r={ANCHOR_RADIUS} stroke="none" />
        </g>
      ))}
    </svg>
  );
}

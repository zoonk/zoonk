import { type DiagramId, type DiagramPartId } from "@zoonk/core/library/activities/diagrams";

/** Color families a drawing is painted in. Each follows light and dark on its own. */
export type DiagramTone =
  | "blue"
  | "brown"
  | "gray"
  | "green"
  | "lime"
  | "orange"
  | "pink"
  | "purple"
  | "red"
  | "sky"
  | "teal"
  | "yellow";

/**
 * How a shape is painted: a tinted `area` with an outline, a paler `soft` area for large
 * backgrounds, a `line` (wires, arrows, thin vessels), a solid `mark` (small dots) or a `region`
 * that stays invisible until its part is highlighted (a wall inside a larger body, a gap).
 */
type DiagramShapeKind = "area" | "line" | "mark" | "region" | "soft";

/** One shape of a drawing, in the drawing's own coordinates, tagged with the part it belongs to. */
export type DiagramShape<TPart extends string = string> = {
  path: string;
  dashed?: boolean;
  kind?: DiagramShapeKind;
  part?: TPart;
  tone: DiagramTone;
  /** Stroke width for lines, in drawing units. */
  width?: number;
};

export type DiagramPoint = readonly [x: number, y: number];

type DiagramPartPlacement = {
  /** A point on the part itself, where a pin's leader line ends. */
  anchor: DiagramPoint;
  /** Where the numbered pin sits when the part is too small or crowded to hold it. */
  pin?: DiagramPoint;
};

/** What a legend entry says, translated by the player. */
export type DiagramLegendKey = "oxygenPoor" | "oxygenRich";

export type DiagramDrawing<TId extends DiagramId> = {
  height: number;
  legend?: readonly { key: DiagramLegendKey; tone: DiagramTone }[];
  /** Every part the catalog lists for this diagram, so any of them can be labeled. */
  parts: Record<DiagramPartId<TId>, DiagramPartPlacement>;
  /** Painted in order, so later shapes sit on top. */
  shapes: readonly DiagramShape<DiagramPartId<TId>>[];
  width: number;
};

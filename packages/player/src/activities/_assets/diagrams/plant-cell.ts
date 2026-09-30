/* oxlint-disable no-magic-numbers -- A drawing is coordinates. */
import { type DiagramPartId } from "@zoonk/core/library/activities/diagrams";
import { axisLine, circle, ellipse, rect, zigzag } from "./diagram-shapes";
import { type DiagramDrawing, type DiagramShape } from "./diagram-types";

type Part = DiagramShape<DiagramPartId<"plant-cell">>;

const WALL = rect({ height: 220, radius: 22, width: 280, x: 30, y: 10 });
const INSIDE = rect({ height: 196, radius: 14, width: 256, x: 42, y: 22 });

const CHLOROPLASTS = [
  { cx: 74, cy: 146, rotate: 25 },
  { cx: 100, cy: 197, rotate: -8 },
  { cx: 282, cy: 76, rotate: 90 },
  { cx: 282, cy: 150, rotate: 90 },
  { cx: 190, cy: 35, rotate: 0 },
  { cx: 180, cy: 205, rotate: 0 },
] as const;

const chloroplasts: Part[] = CHLOROPLASTS.flatMap((shape) => [
  { part: "chloroplast", path: ellipse({ ...shape, rx: 15, ry: 7.5 }), tone: "green" },
  {
    kind: "line",
    part: "chloroplast",
    path: axisLine({ ...shape, length: 20 }),
    tone: "green",
    width: 1.5,
  },
]);

/** A plant cell: a wall around the membrane, a large vacuole and chloroplasts. */
export const plantCell: DiagramDrawing<"plant-cell"> = {
  height: 240,
  parts: {
    "cell-membrane": { anchor: [42, 176], pin: [66, 176] },
    "cell-wall": { anchor: [36, 120], pin: [13, 120] },
    "central-vacuole": { anchor: [193, 120] },
    chloroplast: { anchor: [282, 150] },
    cytoplasm: { anchor: [106, 112] },
    mitochondrion: { anchor: [238, 205] },
    nucleus: { anchor: [78, 82] },
  },
  shapes: [
    { part: "cell-wall", path: WALL, tone: "green" },
    { kind: "soft", part: "cytoplasm", path: INSIDE, tone: "lime" },
    { kind: "line", part: "cell-membrane", path: INSIDE, tone: "lime", width: 2.5 },
    {
      part: "central-vacuole",
      path: rect({ height: 144, radius: 32, width: 146, x: 120, y: 48 }),
      tone: "sky",
    },
    ...chloroplasts,
    { part: "mitochondrion", path: ellipse({ cx: 238, cy: 205, rx: 12, ry: 6 }), tone: "orange" },
    {
      kind: "line",
      part: "mitochondrion",
      path: zigzag({ amplitude: 3, cx: 238, cy: 205, length: 16, teeth: 3 }),
      tone: "orange",
      width: 1.25,
    },
    { part: "nucleus", path: circle(84, 76, 24), tone: "purple" },
    { kind: "mark", part: "nucleus", path: circle(90, 70, 7), tone: "purple" },
  ],
  width: 320,
};

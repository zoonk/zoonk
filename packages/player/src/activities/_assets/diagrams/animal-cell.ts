/* oxlint-disable no-magic-numbers -- A drawing is coordinates. */
import { type DiagramPartId } from "@zoonk/core/library/activities/diagrams";
import { arc, circle, ellipse, onCircle, zigzag } from "./diagram-shapes";
import { type DiagramDrawing, type DiagramShape } from "./diagram-types";

type Part = DiagramShape<DiagramPartId<"animal-cell">>;

const CELL =
  "M40 112 C36 60 92 22 162 20 C238 18 292 54 296 114 C300 172 250 222 164 222 C84 224 44 172 40 112 Z";

const NUCLEUS = { cx: 146, cy: 114 } as const;

const MITOCHONDRIA = [
  { cx: 240, cy: 178, rotate: -20, rx: 24, ry: 12 },
  { cx: 86, cy: 72, rotate: 32, rx: 20, ry: 10 },
] as const;

const FREE_RIBOSOMES = [
  [108, 50],
  [116, 42],
  [252, 96],
  [262, 104],
  [236, 126],
  [196, 200],
  [206, 206],
  [126, 204],
  [64, 124],
  [72, 116],
] as const;

const mitochondria: Part[] = MITOCHONDRIA.flatMap((shape) => [
  { part: "mitochondrion", path: ellipse(shape), tone: "orange" },
  {
    kind: "line",
    part: "mitochondrion",
    path: zigzag({
      amplitude: shape.ry * 0.55,
      cx: shape.cx,
      cy: shape.cy,
      length: shape.rx * 1.4,
      rotate: shape.rotate,
      teeth: 4,
    }),
    tone: "orange",
    width: 1.5,
  },
]);

const roughEr: Part[] = [
  ...[50, 58, 66].map((radius): Part => ({
    kind: "line",
    part: "rough-endoplasmic-reticulum",
    path: arc({ ...NUCLEUS, from: -55, radius, to: 55 }),
    tone: "blue",
    width: 3.5,
  })),
  ...[54, 62].flatMap((radius) =>
    [-45, -25, -5, 15, 35].map((angle): Part => ({
      kind: "mark",
      part: "rough-endoplasmic-reticulum",
      path: circle(...onCircle({ ...NUCLEUS, angle, radius }), 1.8),
      tone: "purple",
    })),
  ),
];

const GOLGI_SACS = [
  "M62 146 Q86 136 110 148",
  "M60 156 Q86 146 112 158",
  "M60 166 Q86 156 112 168",
  "M62 176 Q86 166 110 178",
] as const;

const golgi: Part[] = [
  ...GOLGI_SACS.map((path): Part => ({
    kind: "line",
    part: "golgi-apparatus",
    path,
    tone: "teal",
    width: 5,
  })),
  { part: "golgi-apparatus", path: circle(118, 142, 3.5), tone: "teal" },
  { part: "golgi-apparatus", path: circle(116, 184, 3.5), tone: "teal" },
];

/** An animal cell: no wall, a round nucleus and the organelles lessons name most. */
export const animalCell: DiagramDrawing<"animal-cell"> = {
  height: 240,
  parts: {
    "cell-membrane": { anchor: [41, 112] },
    cytoplasm: { anchor: [160, 192] },
    "golgi-apparatus": { anchor: [86, 164] },
    lysosome: { anchor: [210, 70] },
    mitochondrion: { anchor: [240, 178] },
    nucleolus: { anchor: [156, 106], pin: [154, 42] },
    nucleus: { anchor: [126, 130] },
    ribosome: { anchor: [262, 104], pin: [276, 70] },
    "rough-endoplasmic-reticulum": { anchor: [204, 114] },
  },
  shapes: [
    { kind: "soft", part: "cytoplasm", path: CELL, tone: "orange" },
    { kind: "line", part: "cell-membrane", path: CELL, tone: "orange", width: 4 },
    ...roughEr,
    ...golgi,
    ...mitochondria,
    { part: "lysosome", path: circle(210, 70, 9), tone: "green" },
    { part: "lysosome", path: circle(272, 128, 7), tone: "green" },
    ...FREE_RIBOSOMES.map(([x, y]): Part => ({
      kind: "mark",
      part: "ribosome",
      path: circle(x, y, 2.4),
      tone: "purple",
    })),
    { part: "nucleus", path: circle(NUCLEUS.cx, NUCLEUS.cy, 40), tone: "purple" },
    { kind: "mark", part: "nucleolus", path: circle(156, 106, 13), tone: "purple" },
  ],
  width: 320,
};

/* oxlint-disable no-magic-numbers -- A drawing is coordinates. */
import { type DiagramPartId } from "@zoonk/core/library/activities/diagrams";
import { circle, ellipse, rect } from "./diagram-shapes";
import { type DiagramDrawing, type DiagramShape } from "./diagram-types";

type Part = DiagramShape<DiagramPartId<"leaf-cross-section">>;

const LEFT = 10;
const RIGHT = 310;
const STOMA_GAP = { from: 118, to: 150 } as const;

const upperCells = Array.from({ length: 12 }, (_, index): Part => ({
  kind: "soft",
  part: "upper-epidermis",
  path: rect({ height: 18, radius: 4, width: 23, x: LEFT + 1 + index * 25, y: 38 }),
  tone: "sky",
}));

const palisadeCells = Array.from({ length: 15 }, (_, index) => LEFT + 2 + index * 20).flatMap(
  (x): Part[] => [
    {
      part: "palisade-mesophyll",
      path: rect({ height: 54, radius: 8, width: 17, x, y: 58 }),
      tone: "green",
    },
    ...[70, 86, 102].map((y): Part => ({
      kind: "mark",
      part: "palisade-mesophyll",
      path: circle(x + 8.5, y, 2.5),
      tone: "green",
    })),
  ],
);

const SPONGY = [
  [26, 130, 13],
  [58, 140, 12],
  [90, 128, 13],
  [118, 146, 11],
  [150, 128, 12],
  [178, 146, 11],
  [270, 132, 13],
  [298, 148, 10],
  [40, 162, 10],
  [102, 168, 9],
  [262, 164, 10],
] as const;

const lowerCells = Array.from({ length: 12 }, (_, index) => LEFT + 1 + index * 25)
  .filter((x) => x + 23 <= STOMA_GAP.from || x >= STOMA_GAP.to)
  .map((x): Part => ({
    kind: "soft",
    part: "lower-epidermis",
    path: rect({ height: 16, radius: 4, width: 23, x, y: 180 }),
    tone: "sky",
  }));

/** A leaf cut across: waxy cuticle, epidermis, the two mesophyll layers, a vein and a stoma. */
export const leafCrossSection: DiagramDrawing<"leaf-cross-section"> = {
  height: 230,
  parts: {
    cuticle: { anchor: [40, 33], pin: [40, 13] },
    "guard-cell": { anchor: [125, 188], pin: [96, 216] },
    "lower-epidermis": { anchor: [248, 188] },
    "palisade-mesophyll": { anchor: [150, 86] },
    "spongy-mesophyll": { anchor: [58, 140] },
    stoma: { anchor: [134, 190], pin: [150, 216] },
    "upper-epidermis": { anchor: [86, 47] },
    vein: { anchor: [222, 150] },
  },
  shapes: [
    {
      part: "cuticle",
      path: rect({ height: 5, radius: 2, width: RIGHT - LEFT, x: LEFT, y: 31 }),
      tone: "yellow",
    },
    ...upperCells,
    ...palisadeCells,
    ...SPONGY.map(([x, y, radius]): Part => ({
      part: "spongy-mesophyll",
      path: circle(x, y, radius),
      tone: "lime",
    })),
    { kind: "soft", part: "vein", path: circle(222, 148, 24), tone: "yellow" },
    ...[
      [214, 140],
      [230, 140],
      [222, 132],
    ].map(([x = 0, y = 0]): Part => ({ part: "vein", path: circle(x, y, 5), tone: "blue" })),
    ...[
      [214, 158],
      [230, 158],
    ].map(([x = 0, y = 0]): Part => ({ part: "vein", path: circle(x, y, 4.5), tone: "orange" })),
    ...lowerCells,
    { part: "guard-cell", path: ellipse({ cx: 125, cy: 188, rx: 7, ry: 9 }), tone: "green" },
    { part: "guard-cell", path: ellipse({ cx: 143, cy: 188, rx: 7, ry: 9 }), tone: "green" },
    {
      kind: "region",
      part: "stoma",
      path: rect({ height: 18, width: 6, x: 131, y: 179 }),
      tone: "gray",
    },
    {
      part: "cuticle",
      path: rect({ height: 4, radius: 2, width: RIGHT - LEFT, x: LEFT, y: 197 }),
      tone: "yellow",
    },
  ],
  width: 320,
};

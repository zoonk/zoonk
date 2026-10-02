/* oxlint-disable no-magic-numbers -- A drawing is coordinates. */
import { type DiagramPartId } from "@zoonk/core/library/activities/diagrams";
import { circle, ellipse, rect } from "./diagram-shapes";
import { type DiagramDrawing, type DiagramShape } from "./diagram-types";

type Part = DiagramShape<DiagramPartId<"flower">>;

const OVULES = [
  [160, 158],
  [154, 171],
  [166, 171],
] as const;

/** A flower cut down the middle: petals and sepals outside, the male and female parts inside. */
export const flower: DiagramDrawing<"flower"> = {
  height: 260,
  parts: {
    anther: { anchor: [112, 102], pin: [84, 64] },
    filament: { anchor: [124, 138], pin: [102, 150] },
    ovary: { anchor: [170, 168], pin: [226, 176] },
    petal: { anchor: [66, 110] },
    receptacle: { anchor: [176, 192], pin: [206, 238] },
    sepal: { anchor: [120, 204], pin: [104, 238] },
    stem: { anchor: [160, 236] },
    stigma: { anchor: [160, 90], pin: [160, 44] },
    style: { anchor: [161, 124], pin: [208, 136] },
  },
  shapes: [
    {
      part: "stem",
      path: rect({ height: 70, radius: 3, width: 12, x: 154, y: 192 }),
      tone: "green",
    },
    {
      kind: "soft",
      part: "petal",
      path: "M146 176 C134 140 138 96 160 74 C182 96 186 140 174 176 Z",
      tone: "pink",
    },
    {
      part: "petal",
      path: "M146 184 C110 180 58 150 42 104 C40 94 50 88 60 92 C98 106 132 140 150 176 Z",
      tone: "pink",
    },
    {
      part: "petal",
      path: "M174 184 C210 180 262 150 278 104 C280 94 270 88 260 92 C222 106 188 140 170 176 Z",
      tone: "pink",
    },
    {
      part: "sepal",
      path: "M150 188 C132 188 112 196 98 212 C120 214 140 204 152 196 Z",
      tone: "green",
    },
    {
      part: "sepal",
      path: "M170 188 C188 188 208 196 222 212 C200 214 180 204 168 196 Z",
      tone: "green",
    },
    {
      kind: "line",
      part: "filament",
      path: "M150 184 C134 160 120 132 114 108",
      tone: "lime",
      width: 2.5,
    },
    {
      kind: "line",
      part: "filament",
      path: "M170 184 C186 160 200 132 206 108",
      tone: "lime",
      width: 2.5,
    },
    {
      part: "anther",
      path: ellipse({ cx: 112, cy: 102, rotate: -60, rx: 10, ry: 6 }),
      tone: "yellow",
    },
    {
      part: "anther",
      path: ellipse({ cx: 208, cy: 102, rotate: 60, rx: 10, ry: 6 }),
      tone: "yellow",
    },
    { kind: "line", part: "style", path: "M160 150 V96", tone: "lime", width: 6 },
    { part: "stigma", path: ellipse({ cx: 160, cy: 90, rx: 13, ry: 7 }), tone: "orange" },
    { part: "receptacle", path: ellipse({ cx: 160, cy: 192, rx: 26, ry: 10 }), tone: "green" },
    { part: "ovary", path: ellipse({ cx: 160, cy: 166, rx: 18, ry: 20 }), tone: "lime" },
    ...OVULES.map(([x, y]): Part => ({
      kind: "mark",
      part: "ovary",
      path: circle(x, y, 3),
      tone: "lime",
    })),
  ],
  width: 320,
};

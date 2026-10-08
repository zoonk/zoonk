/* oxlint-disable no-magic-numbers -- A drawing is coordinates. */
import { type DiagramPartId } from "@zoonk/core/library/activities/diagrams";
import { circle, rect } from "./diagram-shapes";
import { type DiagramDrawing, type DiagramShape } from "./diagram-types";

type Part = DiagramShape<DiagramPartId<"electric-circuit">>;

const WIRES = [
  "M48 70 V40 H140",
  "M184 40 H272 V92",
  "M272 140 V190 H190",
  "M130 190 H48 V138",
] as const;

/** One loop: a battery pushes current through a switch, a bulb and a resistor. */
export const electricCircuit: DiagramDrawing<"electric-circuit"> = {
  height: 220,
  parts: {
    battery: { anchor: [60, 104], pin: [88, 104] },
    bulb: { anchor: [256, 108], pin: [232, 108] },
    resistor: { anchor: [160, 182], pin: [160, 152] },
    switch: { anchor: [160, 31], pin: [162, 72] },
    wire: { anchor: [90, 190] },
  },
  shapes: [
    ...WIRES.map((path): Part => ({ kind: "line", part: "wire", path, tone: "gray", width: 3 })),
    {
      part: "battery",
      path: rect({ height: 6, radius: 1, width: 12, x: 42, y: 70 }),
      tone: "orange",
    },
    {
      part: "battery",
      path: rect({ height: 58, radius: 5, width: 24, x: 36, y: 76 }),
      tone: "orange",
    },
    { kind: "line", part: "battery", path: "M43 90 H53 M48 85 V95", tone: "orange", width: 2 },
    { kind: "line", part: "battery", path: "M43 120 H53", tone: "orange", width: 2 },
    { kind: "line", part: "switch", path: "M140 40 L178 22", tone: "gray", width: 3 },
    { kind: "mark", part: "switch", path: circle(140, 40, 3.5), tone: "gray" },
    { kind: "mark", part: "switch", path: circle(184, 40, 3.5), tone: "gray" },
    {
      part: "bulb",
      path: rect({ height: 16, radius: 2, width: 16, x: 264, y: 124 }),
      tone: "gray",
    },
    { part: "bulb", path: circle(272, 108, 17), tone: "yellow" },
    {
      kind: "line",
      part: "bulb",
      path: "M266 124 V112 L269 104 L272 112 L275 104 L278 112 V124",
      tone: "orange",
      width: 1.5,
    },
    {
      kind: "line",
      part: "resistor",
      path: "M130 190 L136 180 L148 200 L160 180 L172 200 L184 180 L190 190",
      tone: "brown",
      width: 3,
    },
  ],
  width: 320,
};

/* oxlint-disable no-magic-numbers -- A drawing is coordinates. */
import { ellipse } from "./diagram-shapes";
import { type DiagramDrawing } from "./diagram-types";

/** A volcano cut open mid-eruption, from the magma chamber in the crust to the ash cloud. */
export const volcano: DiagramDrawing<"volcano"> = {
  height: 250,
  parts: {
    "ash-cloud": { anchor: [160, 28] },
    crater: { anchor: [170, 76], pin: [220, 74] },
    crust: { anchor: [40, 222] },
    "lava-flow": { anchor: [226, 136] },
    "magma-chamber": { anchor: [196, 228] },
    "main-vent": { anchor: [160, 158] },
    "side-vent": { anchor: [120, 128] },
  },
  shapes: [
    { part: "crust", path: "M0 180 H320 V214 H0 Z", tone: "brown" },
    { kind: "soft", part: "crust", path: "M0 214 H320 V250 H0 Z", tone: "brown" },
    { path: "M20 182 C60 170 110 120 140 70 H180 C210 120 260 170 300 182 Z", tone: "gray" },
    { part: "crater", path: "M138 68 C150 84 170 84 182 68 Z", tone: "orange" },
    {
      part: "side-vent",
      path: "M152 150 C130 140 112 128 100 118 L106 110 C118 120 136 132 154 140 Z",
      tone: "orange",
    },
    {
      part: "main-vent",
      path: "M154 78 C152 120 150 170 152 214 H168 C170 170 168 120 166 78 Z",
      tone: "orange",
    },
    { part: "magma-chamber", path: ellipse({ cx: 160, cy: 226, rx: 56, ry: 16 }), tone: "red" },
    {
      part: "lava-flow",
      path: "M180 72 C196 96 214 124 240 150 C252 162 260 170 262 178 L250 178 C244 166 232 154 220 142 C200 120 186 96 174 76 Z",
      tone: "red",
    },
    {
      part: "ash-cloud",
      path: "M110 50 C92 50 88 32 104 26 C104 10 126 4 138 14 C146 0 176 0 182 14 C196 6 216 14 212 30 C228 32 230 50 214 52 C204 58 186 56 180 50 C170 58 150 58 142 50 C134 56 116 56 110 50 Z",
      tone: "gray",
    },
  ],
  width: 320,
};

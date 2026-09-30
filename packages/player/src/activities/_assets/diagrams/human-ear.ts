/* oxlint-disable no-magic-numbers -- A drawing is coordinates. */
import { circle, ellipse, spiral } from "./diagram-shapes";
import { type DiagramDrawing } from "./diagram-types";

/** The ear cut open: sound runs down the canal to the eardrum, the ossicles and the cochlea. */
export const humanEar: DiagramDrawing<"human-ear"> = {
  height: 220,
  parts: {
    "auditory-nerve": { anchor: [294, 108] },
    cochlea: { anchor: [236, 140] },
    "ear-canal": { anchor: [110, 111] },
    eardrum: { anchor: [152, 118], pin: [140, 152] },
    "eustachian-tube": { anchor: [212, 188] },
    ossicles: { anchor: [178, 102], pin: [174, 60] },
    pinna: { anchor: [30, 112] },
    "semicircular-canals": { anchor: [248, 56], pin: [282, 40] },
  },
  shapes: [
    {
      part: "eustachian-tube",
      path: "M168 124 C176 150 200 180 226 212 L238 204 C212 174 188 146 180 122 Z",
      tone: "gray",
    },
    {
      part: "auditory-nerve",
      path: "M254 118 C276 110 296 104 320 100 V116 C298 120 280 126 258 134 Z",
      tone: "yellow",
    },
    { kind: "soft", part: "ear-canal", path: "M70 96 H152 V126 H70 Z", tone: "orange" },
    {
      part: "pinna",
      path: "M40 30 C14 40 8 90 18 124 C26 150 34 170 46 186 C52 192 60 188 58 180 C56 160 64 150 74 144 V80 C70 50 58 30 40 30 Z",
      tone: "pink",
    },
    { kind: "line", part: "pinna", path: "M42 52 C30 72 30 102 42 122", tone: "pink", width: 2 },
    ...[
      { cx: 222, cy: 66, radius: 14 },
      { cx: 244, cy: 54, radius: 12 },
      { cx: 244, cy: 80, radius: 11 },
    ].map(({ cx, cy, radius }) => ({
      kind: "line" as const,
      part: "semicircular-canals" as const,
      path: circle(cx, cy, radius),
      tone: "purple" as const,
      width: 5,
    })),
    { path: ellipse({ cx: 214, cy: 104, rx: 16, ry: 12 }), tone: "purple" },
    {
      kind: "line",
      part: "cochlea",
      path: spiral({ cx: 238, cy: 138, fromRadius: 22, start: 200, toRadius: 4, turns: 2.2 }),
      tone: "purple",
      width: 6,
    },
    {
      part: "ossicles",
      path: "M156 100 C162 94 170 92 174 98 C170 104 164 110 158 116 Z",
      tone: "gray",
    },
    {
      part: "ossicles",
      path: "M174 96 C180 90 188 92 190 100 C186 106 182 110 178 112 Z",
      tone: "gray",
    },
    { part: "ossicles", path: "M182 112 L196 106 L198 118 L186 122 Z", tone: "gray" },
    {
      part: "eardrum",
      path: ellipse({ cx: 152, cy: 111, rotate: 8, rx: 3, ry: 18 }),
      tone: "orange",
    },
  ],
  width: 320,
};

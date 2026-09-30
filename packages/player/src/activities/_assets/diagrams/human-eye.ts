/* oxlint-disable no-magic-numbers -- A drawing is coordinates. */
import { arc, circle, ellipse, rect } from "./diagram-shapes";
import { type DiagramDrawing } from "./diagram-types";

const CENTER = { cx: 186, cy: 110 } as const;

/** The eye from the side, light coming in from the left through the cornea, pupil and lens. */
export const humanEye: DiagramDrawing<"human-eye"> = {
  height: 220,
  parts: {
    cornea: { anchor: [95, 88], pin: [58, 58] },
    iris: { anchor: [126, 84], pin: [118, 24] },
    lens: { anchor: [146, 134], pin: [146, 200] },
    "optic-nerve": { anchor: [296, 111] },
    pupil: { anchor: [127, 110], pin: [44, 118] },
    retina: { anchor: [244, 159], pin: [280, 192] },
    sclera: { anchor: [199, 34], pin: [232, 14] },
    "vitreous-humor": { anchor: [206, 124] },
  },
  shapes: [
    {
      part: "optic-nerve",
      path: "M262 97 C282 99 300 100 320 98 V126 C300 124 282 124 262 126 Z",
      tone: "yellow",
    },
    { part: "sclera", path: circle(CENTER.cx, CENTER.cy, 82), tone: "gray" },
    { kind: "soft", part: "vitreous-humor", path: circle(CENTER.cx, CENTER.cy, 72), tone: "sky" },
    {
      kind: "line",
      part: "retina",
      path: arc({ ...CENTER, from: -118, radius: 76, to: 118 }),
      tone: "pink",
      width: 5,
    },
    { part: "cornea", path: "M119 63 C80 74 80 146 119 157 C108 136 106 84 119 63 Z", tone: "sky" },
    { part: "iris", path: rect({ height: 26, radius: 3, width: 7, x: 122, y: 72 }), tone: "brown" },
    {
      part: "iris",
      path: rect({ height: 26, radius: 3, width: 7, x: 122, y: 122 }),
      tone: "brown",
    },
    {
      kind: "region",
      part: "pupil",
      path: rect({ height: 24, width: 9, x: 121, y: 98 }),
      tone: "gray",
    },
    { part: "lens", path: ellipse({ cx: 146, cy: 110, rx: 11, ry: 25 }), tone: "sky" },
    { dashed: true, kind: "line", path: "M0 92 L128 104 L258 112", tone: "yellow", width: 1.5 },
    { dashed: true, kind: "line", path: "M0 130 L128 116 L258 110", tone: "yellow", width: 1.5 },
  ],
  width: 320,
};

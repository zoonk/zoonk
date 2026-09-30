/* oxlint-disable no-magic-numbers -- A drawing is coordinates. */
import { circle } from "./diagram-shapes";
import { type DiagramDrawing } from "./diagram-types";

/** The Earth cut through its center: a thin crust, the mantle and a liquid and solid core. */
export const earthLayers: DiagramDrawing<"earth-layers"> = {
  height: 240,
  parts: {
    crust: { anchor: [238, 42], pin: [292, 34] },
    "inner-core": { anchor: [160, 120] },
    mantle: { anchor: [84, 92] },
    "outer-core": { anchor: [193, 152] },
  },
  shapes: [
    { part: "crust", path: circle(160, 120, 112), tone: "brown" },
    { part: "mantle", path: circle(160, 120, 103), tone: "red" },
    { part: "outer-core", path: circle(160, 120, 60), tone: "orange" },
    { part: "inner-core", path: circle(160, 120, 30), tone: "yellow" },
  ],
  width: 320,
};

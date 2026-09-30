/* oxlint-disable no-magic-numbers -- A drawing is coordinates. */
import { type DiagramPartId } from "@zoonk/core/library/activities/diagrams";
import { circle, rect } from "./diagram-shapes";
import { type DiagramDrawing, type DiagramShape } from "./diagram-types";

type Part = DiagramShape<DiagramPartId<"neuron">>;

const DENDRITES = [
  "M58 80 L40 60 L28 62",
  "M40 60 L34 44",
  "M52 118 L32 132 L18 128",
  "M32 132 L28 150",
  "M70 70 L72 44 L62 30",
  "M72 44 L84 30",
  "M66 128 L62 156 L50 166",
  "M62 156 L72 170",
  "M48 96 L20 94 L10 84",
  "M20 94 L12 104",
] as const;

const SHEATHS = [122, 162, 202, 242] as const;
const SHEATH_WIDTH = 32;

const TERMINALS = [
  [298, 78],
  [306, 100],
  [298, 122],
] as const;

/** A motor neuron: dendrites bring signals in, the axon carries them out to its terminals. */
export const neuron: DiagramDrawing<"neuron"> = {
  height: 190,
  parts: {
    axon: { anchor: [113, 100], pin: [116, 146] },
    "axon-terminal": { anchor: [298, 124], pin: [296, 158] },
    "cell-body": { anchor: [90, 117] },
    dendrite: { anchor: [26, 94] },
    "myelin-sheath": { anchor: [178, 100] },
    "node-of-ranvier": { anchor: [158, 104], pin: [158, 146] },
    nucleus: { anchor: [76, 97], pin: [100, 46] },
  },
  shapes: [
    ...DENDRITES.map((path): Part => ({
      kind: "line",
      part: "dendrite",
      path,
      tone: "purple",
      width: 3,
    })),
    ...TERMINALS.map(([x, y]): Part => ({
      kind: "line",
      part: "axon-terminal",
      path: `M276 100 L${x} ${y}`,
      tone: "purple",
      width: 3,
    })),
    ...TERMINALS.map(([x, y]): Part => ({
      part: "axon-terminal",
      path: circle(x, y, 5),
      tone: "purple",
    })),
    { kind: "line", part: "axon", path: "M100 100 H278", tone: "purple", width: 4 },
    {
      part: "cell-body",
      path: "M60 72 C80 64 100 80 104 96 C106 112 94 128 76 130 C58 132 44 120 44 104 C44 88 48 76 60 72 Z",
      tone: "purple",
    },
    { kind: "mark", part: "nucleus", path: circle(74, 100, 11), tone: "purple" },
    ...SHEATHS.map((x): Part => ({
      part: "myelin-sheath",
      path: rect({ height: 18, radius: 9, width: x === 242 ? 24 : SHEATH_WIDTH, x, y: 91 }),
      tone: "yellow",
    })),
    ...SHEATHS.slice(0, -1).map((x): Part => ({
      kind: "region",
      part: "node-of-ranvier",
      path: rect({ height: 14, width: 8, x: x + SHEATH_WIDTH, y: 93 }),
      tone: "purple",
    })),
  ],
  width: 320,
};

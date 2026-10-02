/* oxlint-disable no-magic-numbers -- A drawing is coordinates. */
import { type DiagramPartId } from "@zoonk/core/library/activities/diagrams";
import { circle, onCircle } from "./diagram-shapes";
import { type DiagramDrawing, type DiagramShape } from "./diagram-types";

type Part = DiagramShape<DiagramPartId<"atom">>;

const CENTER = { cx: 160, cy: 120 } as const;
const SHELLS = [52, 96] as const;
const NUCLEON_RADIUS = 7.5;

/** Carbon-12: six protons and six neutrons, packed so the two kinds alternate. */
const OUTER_NUCLEONS = Array.from({ length: 9 }, (_, index) =>
  onCircle({ ...CENTER, angle: index * 40, radius: 14.5 }),
);

const INNER_NUCLEONS = [
  [155, 116],
  [165, 116],
  [160, 125],
] as const;

const nucleons: Part[] = [...OUTER_NUCLEONS, ...INNER_NUCLEONS].map(([x, y], index): Part =>
  index % 2 === 0
    ? { part: "proton", path: circle(x, y, NUCLEON_RADIUS), tone: "red" }
    : { part: "neutron", path: circle(x, y, NUCLEON_RADIUS), tone: "gray" },
);

const electrons: Part[] = [
  ...[90, 270].map((angle) => onCircle({ ...CENTER, angle, radius: SHELLS[0] })),
  ...[45, 135, 225, 315].map((angle) => onCircle({ ...CENTER, angle, radius: SHELLS[1] })),
].map(([x, y]): Part => ({ kind: "mark", part: "electron", path: circle(x, y, 5), tone: "blue" }));

/** A carbon atom in the shell model: a nucleus of protons and neutrons, electrons in two shells. */
export const atom: DiagramDrawing<"atom"> = {
  height: 240,
  parts: {
    electron: { anchor: [228, 188], pin: [272, 214] },
    "electron-shell": { anchor: [64, 120] },
    neutron: { anchor: [149, 125], pin: [135, 190] },
    nucleus: { anchor: [146, 110], pin: [92, 95] },
    proton: { anchor: [171, 111], pin: [221, 78] },
  },
  shapes: [
    ...SHELLS.map((radius): Part => ({
      dashed: true,
      kind: "line",
      part: "electron-shell",
      path: circle(CENTER.cx, CENTER.cy, radius),
      tone: "gray",
      width: 1.5,
    })),
    { kind: "region", part: "nucleus", path: circle(CENTER.cx, CENTER.cy, 24), tone: "gray" },
    ...nucleons,
    ...electrons,
  ],
  width: 320,
};

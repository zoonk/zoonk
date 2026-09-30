/* oxlint-disable no-magic-numbers -- A drawing is coordinates. */
import { type DiagramPartId } from "@zoonk/core/library/activities/diagrams";
import { circle, ellipse, onCircle } from "./diagram-shapes";
import { type DiagramDrawing, type DiagramShape } from "./diagram-types";

type Part = DiagramShape<DiagramPartId<"plant">>;

const ROOTS = [
  "M160 196 C158 214 152 228 140 244",
  "M160 196 C164 216 172 232 186 246",
  "M157 206 C140 212 128 214 112 222",
  "M163 208 C180 214 194 214 210 222",
  "M160 198 V254",
  "M146 236 L132 238",
  "M178 236 L190 234",
] as const;

const FLOWER = { cx: 160, cy: 44 } as const;

const petals = Array.from({ length: 5 }, (_, index): Part => {
  const angle = index * 72 - 90;
  const [cx, cy] = onCircle({ ...FLOWER, angle, radius: 13 });
  return { part: "flower", path: ellipse({ cx, cy, rotate: angle, rx: 12, ry: 7 }), tone: "pink" };
});

const LEAVES = [
  { blade: "M158 170 C140 156 116 156 100 170 C118 182 142 182 158 170 Z", vein: "M158 170 H104" },
  { blade: "M162 140 C180 126 206 126 222 138 C204 152 180 152 162 140 Z", vein: "M162 140 H218" },
] as const;

/** A flowering plant above and below the soil: roots, stem, leaves, a flower, a bud and a fruit. */
export const plant: DiagramDrawing<"plant"> = {
  height: 260,
  parts: {
    bud: { anchor: [214, 80], pin: [252, 62] },
    flower: { anchor: [160, 44] },
    fruit: { anchor: [100, 150], pin: [68, 122] },
    leaf: { anchor: [126, 170] },
    roots: { anchor: [186, 240] },
    stem: { anchor: [160, 100] },
  },
  shapes: [
    { kind: "soft", path: "M0 196 H320 V260 H0 Z", tone: "brown" },
    ...ROOTS.map((path): Part => ({
      kind: "line",
      part: "roots",
      path,
      tone: "brown",
      width: 2.5,
    })),
    {
      kind: "line",
      part: "stem",
      path: "M160 196 C160 150 158 110 160 56",
      tone: "green",
      width: 6,
    },
    {
      kind: "line",
      part: "stem",
      path: "M159 120 C176 110 194 98 210 86",
      tone: "green",
      width: 3,
    },
    {
      kind: "line",
      part: "stem",
      path: "M160 150 C144 142 124 138 104 138",
      tone: "green",
      width: 3,
    },
    ...LEAVES.flatMap(({ blade, vein }): Part[] => [
      { part: "leaf", path: blade, tone: "green" },
      { kind: "line", part: "leaf", path: vein, tone: "green", width: 1.25 },
    ]),
    { part: "bud", path: ellipse({ cx: 214, cy: 80, rotate: 50, rx: 11, ry: 6 }), tone: "pink" },
    { part: "bud", path: ellipse({ cx: 208, cy: 86, rotate: 50, rx: 6, ry: 5 }), tone: "green" },
    { kind: "line", part: "fruit", path: "M104 138 V140", tone: "green", width: 2 },
    { part: "fruit", path: circle(102, 152, 12), tone: "red" },
    ...petals,
    { part: "flower", path: circle(FLOWER.cx, FLOWER.cy, 7), tone: "yellow" },
  ],
  width: 320,
};

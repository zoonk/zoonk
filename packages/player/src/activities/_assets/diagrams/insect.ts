/* oxlint-disable no-magic-numbers -- A drawing is coordinates. */
import { type DiagramPartId } from "@zoonk/core/library/activities/diagrams";
import { circle, ellipse } from "./diagram-shapes";
import { type DiagramDrawing, type DiagramShape } from "./diagram-types";

type Part = DiagramShape<DiagramPartId<"insect">>;

const WINGS = [
  { cx: 108, cy: 84, rotate: -18, rx: 46, ry: 16 },
  { cx: 212, cy: 84, rotate: 18, rx: 46, ry: 16 },
  { cx: 118, cy: 122, rotate: 14, rx: 38, ry: 13 },
  { cx: 202, cy: 122, rotate: -14, rx: 38, ry: 13 },
] as const;

const LEGS = [
  "M150 90 L128 72 L118 50",
  "M170 90 L192 72 L202 50",
  "M148 102 L116 112 L96 140",
  "M172 102 L204 112 L224 140",
  "M150 112 L124 146 L118 184",
  "M170 112 L196 146 L202 184",
] as const;

const ANTENNAE = ["M152 36 C144 20 132 12 120 10", "M168 36 C176 20 188 12 200 10"] as const;
const ABDOMEN_BANDS = [148, 164, 180, 196] as const;

/** An insect from above: three body parts, six legs on the thorax, wings and antennae. */
export const insect: DiagramDrawing<"insect"> = {
  height: 230,
  parts: {
    abdomen: { anchor: [160, 176] },
    antenna: { anchor: [126, 12], pin: [96, 24] },
    "compound-eye": { anchor: [172, 44], pin: [230, 38] },
    head: { anchor: [160, 55] },
    leg: { anchor: [222, 137] },
    thorax: { anchor: [160, 100] },
    wing: { anchor: [92, 82] },
  },
  shapes: [
    ...WINGS.map((wing): Part => ({
      kind: "soft",
      part: "wing",
      path: ellipse(wing),
      tone: "sky",
    })),
    ...LEGS.map((path): Part => ({ kind: "line", part: "leg", path, tone: "brown", width: 3 })),
    ...ANTENNAE.map((path): Part => ({
      kind: "line",
      part: "antenna",
      path,
      tone: "brown",
      width: 2,
    })),
    { part: "abdomen", path: ellipse({ cx: 160, cy: 168, rx: 26, ry: 46 }), tone: "brown" },
    ...ABDOMEN_BANDS.map((y): Part => ({
      kind: "line",
      part: "abdomen",
      path: `M${138 + Math.abs(y - 168) * 0.2} ${y} Q160 ${y + 6} ${182 - Math.abs(y - 168) * 0.2} ${y}`,
      tone: "brown",
      width: 1.5,
    })),
    { part: "thorax", path: ellipse({ cx: 160, cy: 100, rx: 18, ry: 20 }), tone: "brown" },
    { part: "head", path: circle(160, 48, 16), tone: "brown" },
    {
      kind: "mark",
      part: "compound-eye",
      path: ellipse({ cx: 148, cy: 44, rotate: 20, rx: 5, ry: 8 }),
      tone: "gray",
    },
    {
      kind: "mark",
      part: "compound-eye",
      path: ellipse({ cx: 172, cy: 44, rotate: -20, rx: 5, ry: 8 }),
      tone: "gray",
    },
  ],
  width: 320,
};

/* oxlint-disable no-magic-numbers -- A drawing is coordinates. */
import { type DiagramPartId } from "@zoonk/core/library/activities/diagrams";
import { rect } from "./diagram-shapes";
import { type DiagramDrawing, type DiagramShape } from "./diagram-types";

type Part = DiagramShape<DiagramPartId<"respiratory-system">>;

const LUNGS = [
  "M142 120 C112 116 70 150 62 206 C58 236 70 256 96 254 C120 252 140 240 146 222 C150 190 150 150 142 120 Z",
  "M178 120 C208 116 250 150 258 206 C262 236 250 256 224 254 C200 252 182 242 176 226 C188 218 190 204 180 196 C176 170 172 146 178 120 Z",
] as const;

const BRONCHIOLES = [
  "M128 172 L110 186 L96 204",
  "M110 186 L100 178",
  "M128 172 L118 202 L112 226",
  "M118 202 L130 216",
  "M192 172 L210 186 L224 204",
  "M210 186 L220 178",
  "M192 172 L202 202 L208 226",
  "M202 202 L190 216",
] as const;

const TRACHEA_RINGS = Array.from({ length: 6 }, (_, index) => 94 + index * 9);

/** The airways from the nose to the lungs, front view, over the domed diaphragm. */
export const respiratorySystem: DiagramDrawing<"respiratory-system"> = {
  height: 280,
  parts: {
    bronchiole: { anchor: [104, 194] },
    bronchus: { anchor: [142, 164] },
    diaphragm: { anchor: [160, 246] },
    larynx: { anchor: [160, 75] },
    lung: { anchor: [226, 212] },
    "nasal-cavity": { anchor: [160, 26] },
    trachea: { anchor: [160, 120] },
  },
  shapes: [
    ...LUNGS.map((path): Part => ({ part: "lung", path, tone: "pink" })),
    ...BRONCHIOLES.map((path): Part => ({
      kind: "line",
      part: "bronchiole",
      path,
      tone: "gray",
      width: 2.5,
    })),
    {
      kind: "line",
      part: "bronchus",
      path: "M160 146 C152 158 142 164 128 172 M160 146 C168 158 178 164 192 172",
      tone: "gray",
      width: 7,
    },
    { kind: "line", path: "M160 40 V66", tone: "pink", width: 10 },
    {
      part: "nasal-cavity",
      path: "M146 14 C150 8 170 8 174 14 L182 36 C176 42 144 42 138 36 Z",
      tone: "pink",
    },
    {
      part: "trachea",
      path: rect({ height: 62, radius: 3, width: 16, x: 152, y: 86 }),
      tone: "gray",
    },
    ...TRACHEA_RINGS.map((y): Part => ({
      kind: "line",
      part: "trachea",
      path: `M152 ${y} H168`,
      tone: "gray",
      width: 1.5,
    })),
    {
      part: "larynx",
      path: rect({ height: 22, radius: 6, width: 24, x: 148, y: 64 }),
      tone: "gray",
    },
    {
      kind: "line",
      part: "diaphragm",
      path: "M40 270 C80 250 120 244 160 246 C200 244 240 250 280 270",
      tone: "red",
      width: 6,
    },
  ],
  width: 320,
};

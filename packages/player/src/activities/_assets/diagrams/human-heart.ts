/* oxlint-disable no-magic-numbers -- A drawing is coordinates. */
import { rect } from "./diagram-shapes";
import { type DiagramDrawing } from "./diagram-types";

/**
 * The heart seen from the front, as textbooks draw it: the heart's right side is on the viewer's
 * left. Blue carries blood low in oxygen, red blood rich in it.
 */
export const humanHeart: DiagramDrawing<"human-heart"> = {
  height: 270,
  legend: [
    { key: "oxygenPoor", tone: "blue" },
    { key: "oxygenRich", tone: "red" },
  ],
  parts: {
    aorta: { anchor: [224, 23] },
    "inferior-vena-cava": { anchor: [64, 234] },
    "left-atrium": { anchor: [222, 124] },
    "left-ventricle": { anchor: [214, 194] },
    "pulmonary-artery": { anchor: [138, 80] },
    "pulmonary-veins": { anchor: [292, 126] },
    "right-atrium": { anchor: [100, 125] },
    "right-ventricle": { anchor: [110, 190] },
    septum: { anchor: [168, 200], pin: [134, 256] },
    "superior-vena-cava": { anchor: [104, 40] },
  },
  shapes: [
    {
      part: "pulmonary-artery",
      path: "M126 110 V76 Q126 66 116 66 H40 Q34 66 34 59 Q34 52 40 52 H296 Q302 52 302 59 Q302 66 296 66 H160 Q150 66 150 76 V110 Z",
      tone: "blue",
    },
    {
      part: "aorta",
      path: "M168 110 V58 C168 26 196 12 224 12 C254 12 276 28 276 58 V112 H254 V60 C254 42 242 34 224 34 C206 34 192 42 192 58 V110 Z",
      tone: "red",
    },
    {
      part: "superior-vena-cava",
      path: rect({ height: 96, radius: 10, width: 24, x: 92, y: 14 }),
      tone: "blue",
    },
    {
      part: "inferior-vena-cava",
      path: "M62 150 C58 178 54 214 52 256 H76 C78 216 82 184 88 154 Z",
      tone: "blue",
    },
    {
      part: "pulmonary-veins",
      path: rect({ height: 10, radius: 5, width: 52, x: 254, y: 112 }),
      tone: "red",
    },
    {
      part: "pulmonary-veins",
      path: rect({ height: 10, radius: 5, width: 52, x: 254, y: 130 }),
      tone: "red",
    },
    {
      path: "M76 94 C100 84 130 88 160 92 C196 86 240 84 258 100 C276 116 278 152 264 180 C246 214 212 238 184 252 C176 256 168 254 160 248 C120 226 70 198 58 162 C48 132 54 104 76 94 Z",
      tone: "pink",
    },
    {
      kind: "region",
      part: "septum",
      path: "M152 100 H168 V150 L186 234 C180 242 170 242 164 234 L152 160 Z",
      tone: "pink",
    },
    {
      part: "right-atrium",
      path: "M72 106 C84 98 118 98 144 104 C150 106 152 112 152 120 V142 C152 148 148 150 142 150 H84 C72 150 64 140 64 126 C64 116 66 110 72 106 Z",
      tone: "blue",
    },
    {
      part: "left-atrium",
      path: "M170 104 C196 96 236 96 250 106 C258 114 260 130 254 140 C250 146 244 148 236 148 H178 C172 148 168 144 168 138 V112 C168 108 168 106 170 104 Z",
      tone: "red",
    },
    {
      part: "right-ventricle",
      path: "M70 160 H146 C150 160 152 162 152 166 L160 226 C160 232 156 234 150 232 C118 222 88 204 76 186 C70 178 68 168 70 160 Z",
      tone: "blue",
    },
    {
      part: "left-ventricle",
      path: "M176 160 H250 C256 160 258 164 256 170 C250 196 228 222 196 238 C190 241 184 238 184 232 L172 168 C171 163 172 160 176 160 Z",
      tone: "red",
    },
  ],
  width: 320,
};

/* oxlint-disable no-magic-numbers -- A drawing is coordinates. */
import { circle, ellipse, rect } from "./diagram-shapes";
import { type DiagramDrawing } from "./diagram-types";

/** The digestive tract from mouth to rectum, front view, with the liver, gallbladder and pancreas. */
export const digestiveSystem: DiagramDrawing<"digestive-system"> = {
  height: 310,
  parts: {
    esophagus: { anchor: [161, 84] },
    gallbladder: { anchor: [130, 154], pin: [92, 178] },
    "large-intestine": { anchor: [110, 238] },
    liver: { anchor: [108, 124] },
    mouth: { anchor: [156, 41], pin: [112, 34] },
    pancreas: { anchor: [176, 186] },
    rectum: { anchor: [163, 296] },
    "small-intestine": { anchor: [162, 246] },
    stomach: { anchor: [212, 140] },
  },
  shapes: [
    { kind: "soft", path: circle(160, 30, 24), tone: "gray" },
    { kind: "soft", path: rect({ height: 18, width: 24, x: 148, y: 50 }), tone: "gray" },
    {
      kind: "soft",
      path: "M100 66 C80 70 72 90 72 120 V310 H248 V120 C248 90 240 70 220 66 Z",
      tone: "gray",
    },
    { part: "mouth", path: ellipse({ cx: 160, cy: 40, rx: 9, ry: 4 }), tone: "pink" },
    {
      kind: "line",
      part: "esophagus",
      path: "M160 46 C160 80 162 100 178 122",
      tone: "pink",
      width: 7,
    },
    {
      part: "pancreas",
      path: "M136 180 C160 174 198 184 218 180 C224 180 226 188 218 190 C198 194 160 190 138 192 C130 192 130 182 136 180 Z",
      tone: "yellow",
    },
    {
      part: "stomach",
      path: "M176 118 C196 108 226 112 230 136 C234 160 214 178 190 176 C176 175 166 168 160 160 C170 160 184 158 190 150 C196 140 186 128 176 128 Z",
      tone: "pink",
    },
    {
      part: "liver",
      path: "M84 110 C96 96 150 96 176 104 C184 108 182 118 172 122 C150 132 120 150 96 152 C82 152 78 128 84 110 Z",
      tone: "brown",
    },
    {
      part: "gallbladder",
      path: ellipse({ cx: 130, cy: 154, rotate: -20, rx: 7, ry: 10 }),
      tone: "green",
    },
    {
      kind: "line",
      part: "large-intestine",
      path: "M110 272 V210 C110 202 116 198 124 198 H198 C206 198 210 202 210 210 V262 C210 276 196 282 180 282",
      tone: "brown",
      width: 12,
    },
    {
      kind: "line",
      part: "small-intestine",
      path: "M130 216 H186 C196 216 196 232 186 232 H138 C128 232 128 248 138 248 H186 C196 248 196 264 186 264 H150",
      tone: "pink",
      width: 7,
    },
    {
      kind: "line",
      part: "rectum",
      path: "M182 282 C168 284 163 290 163 304",
      tone: "orange",
      width: 10,
    },
  ],
  width: 320,
};

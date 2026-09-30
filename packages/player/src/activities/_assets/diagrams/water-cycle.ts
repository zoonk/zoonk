/* oxlint-disable no-magic-numbers -- A drawing is coordinates. */
import { type DiagramPartId } from "@zoonk/core/library/activities/diagrams";
import { arrowHead, circle, onCircle, rect } from "./diagram-shapes";
import { type DiagramDrawing, type DiagramShape } from "./diagram-types";

type Part = DiagramShape<DiagramPartId<"water-cycle">>;
type Point = readonly [number, number];

const CLOUD =
  "M166 54 C154 54 150 40 162 36 C162 24 178 20 186 28 C192 16 214 16 218 30 C232 28 238 44 226 50 C226 56 220 58 214 58 H172 C168 58 166 56 166 54 Z";

const SUN_RAYS = Array.from({ length: 8 }, (_, index) => {
  const [inner, outer] = [22, 28].map((radius) =>
    onCircle({ angle: index * 45, cx: 36, cy: 34, radius }),
  );

  return `M${inner?.join(" ")} L${outer?.join(" ")}`;
});

const RAIN = [
  [182, 66],
  [196, 70],
  [210, 66],
  [188, 86],
  [202, 90],
  [176, 96],
] as const;

/** An arrow: its line and a head at `tip`, pointing away from `from`. */
function arrow({
  dashed,
  from,
  part,
  path,
  tip,
  tone,
}: {
  dashed?: boolean;
  from: Point;
  part: Part["part"];
  path: string;
  tip: Point;
  tone: Part["tone"];
}): Part[] {
  return [
    { dashed, kind: "line", part, path, tone, width: 2.5 },
    { kind: "mark", part, path: arrowHead({ from, tip }), tone },
  ];
}

/** The water cycle over sea and land: water rises as vapor, falls as rain and flows back. */
export const waterCycle: DiagramDrawing<"water-cycle"> = {
  height: 240,
  parts: {
    condensation: { anchor: [198, 40] },
    evaporation: { anchor: [74, 132] },
    groundwater: { anchor: [238, 221] },
    infiltration: { anchor: [157, 198] },
    precipitation: { anchor: [194, 80] },
    "surface-runoff": { anchor: [192, 156] },
    transpiration: { anchor: [300, 100] },
  },
  shapes: [
    { path: circle(36, 34, 15), tone: "yellow" },
    ...SUN_RAYS.map((path): Part => ({ kind: "line", path, tone: "yellow", width: 2 })),
    { path: "M0 180 H112 C108 200 106 220 104 240 H0 Z", tone: "sky" },
    { kind: "line", path: "M10 196 q10 -6 20 0 t20 0 t20 0", tone: "sky", width: 1.5 },
    { kind: "line", path: "M24 214 q10 -6 20 0 t20 0", tone: "sky", width: 1.5 },
    {
      path: "M104 182 C140 176 170 180 320 178 V240 H100 C102 220 104 200 104 182 Z",
      tone: "brown",
    },
    { kind: "soft", part: "groundwater", path: "M100 210 H320 V228 H98 Z", tone: "sky" },
    { path: "M176 181 L238 74 L300 181 Z", tone: "gray" },
    { kind: "soft", path: "M226 95 L238 74 L250 95 L244 99 L238 92 L232 99 Z", tone: "gray" },
    { path: rect({ height: 22, radius: 1, width: 6, x: 297, y: 156 }), tone: "brown" },
    { path: circle(300, 146, 13), tone: "green" },
    { part: "condensation", path: CLOUD, tone: "gray" },
    ...[38, 74].flatMap((x) =>
      arrow({
        dashed: true,
        from: [x, 100],
        part: "evaporation",
        path: `M${x} 172 C${x - 6} 156 ${x + 6} 140 ${x} 124 C${x - 6} 108 ${x + 6} 100 ${x} 92`,
        tip: [x, 88],
        tone: "sky",
      }),
    ),
    ...arrow({
      dashed: true,
      from: [300, 84],
      part: "transpiration",
      path: "M300 128 C294 116 306 104 300 92 C296 86 300 80 300 78",
      tip: [300, 72],
      tone: "teal",
    }),
    ...arrow({
      dashed: true,
      from: [146, 50],
      part: "condensation",
      path: "M88 84 C106 64 132 52 156 48",
      tip: [160, 47],
      tone: "sky",
    }),
    ...RAIN.map(([x, y]): Part => ({
      kind: "line",
      part: "precipitation",
      path: `M${x} ${y} l-4 10`,
      tone: "blue",
      width: 2,
    })),
    ...arrow({
      from: [132, 178],
      part: "surface-runoff",
      path: "M212 122 C200 144 192 162 178 172 C160 178 138 178 122 178",
      tip: [116, 178],
      tone: "blue",
    }),
    ...[150, 164].flatMap((x) =>
      arrow({
        from: [x, 196],
        part: "infiltration",
        path: `M${x} 186 V200`,
        tip: [x, 206],
        tone: "blue",
      }),
    ),
    ...arrow({
      from: [136, 219],
      part: "groundwater",
      path: "M306 219 H126",
      tip: [116, 219],
      tone: "blue",
    }),
  ],
  width: 320,
};

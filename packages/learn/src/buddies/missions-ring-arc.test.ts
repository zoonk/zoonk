import { describe, expect, it } from "vitest";
import { RING_VIEW_BOX, getArcPath } from "./missions-ring-arc";

const CENTER = RING_VIEW_BOX / 2;

const ARC_PATH =
  /^M (?<startX>\S+) (?<startY>\S+) A \S+ \S+ 0 (?<largeArc>[01]) 1 (?<endX>\S+) (?<endY>\S+)$/u;

/** Where an arc starts and ends, and whether SVG draws it the long way round between them. */
function readArc(path: string) {
  const arc = ARC_PATH.exec(path)?.groups ?? {};

  return {
    end: { x: Number(arc.endX), y: Number(arc.endY) },
    longWay: arc.largeArc === "1",
    start: { x: Number(arc.startX), y: Number(arc.startY) },
  };
}

describe(getArcPath, () => {
  it("draws a lone mission as the whole ring but its gap at the top, not a dash across the gap", () => {
    const arc = readArc(getArcPath({ index: 0, total: 1 }));

    expect(arc.longWay).toBe(true);
    expect(arc.start.x).toBeGreaterThan(CENTER);
    expect(arc.end.x).toBeLessThan(CENTER);
    expect(arc.start.y).toBeLessThan(CENTER);
    expect(arc.end.y).toBeLessThan(CENTER);
  });

  it("draws each of several missions' arcs the short way, since each is under half the ring", () => {
    for (const total of [2, 3, 5]) {
      const arcs = Array.from({ length: total }, (_, index) =>
        readArc(getArcPath({ index, total })),
      );

      expect(arcs.map((arc) => arc.longWay)).toStrictEqual(arcs.map(() => false));
    }
  });
});

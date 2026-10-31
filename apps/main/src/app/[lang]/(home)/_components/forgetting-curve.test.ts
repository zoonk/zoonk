import { describe, expect, it } from "vitest";
import { REVIEW_DAYS, TODAY_DAY, dayShare, getForgettingCurve } from "./forgetting-curve";

const VIEWBOX = 1000;

function getPoints(path: string): [number, number][] {
  return path
    .slice(1)
    .split("L")
    .map((point) => {
      const [x = 0, y = 0] = point.split(" ").map(Number);
      return [x, y];
    });
}

function xOf(day: number): number {
  return Math.round(dayShare(day) * VIEWBOX);
}

describe(getForgettingCurve, () => {
  it("dips to the same point before every review, today's included, and comes back to the top after each one", () => {
    const points = getPoints(getForgettingCurve().reviewed);
    const top = Math.min(...points.map(([, y]) => y));
    const reviews = REVIEW_DAYS.filter((day) => day <= TODAY_DAY);
    const atReview = reviews.map((day) => points.filter(([x]) => x === xOf(day)));

    expect(new Set(atReview.map((found) => Math.max(...found.map(([, y]) => y)))).size).toBe(1);

    expect(atReview.every((found) => found.some(([, y]) => y === top))).toBe(true);
  });

  it("goes on from where today's review ends to the next one, while memory without reviews stays low", () => {
    const curve = getForgettingCurve();
    const [start] = getPoints(curve.next);
    const unreviewed = getPoints(curve.unreviewed);
    const reviewedTop = Math.min(...getPoints(curve.reviewed).map(([, y]) => y));

    expect(start).toStrictEqual([xOf(TODAY_DAY), reviewedTop]);
    expect(getPoints(curve.reviewed).at(-1)).toStrictEqual(start);

    expect(unreviewed.at(-1)?.[1]).toBeGreaterThan(
      Math.max(...getPoints(curve.next).map(([, y]) => y)),
    );
  });
});

import { describe, expect, it } from "vitest";
import { FIT, MAX_SCALE, clampPanZoom, panBy, zoomAt } from "./pan-zoom";

/** A phone's viewer: a 390-wide frame, so the square picture fits at 390 by 390. */
const frame = { height: 700, width: 390 };

describe(zoomAt, () => {
  it("keeps the spot under the fingers where it was", () => {
    const point = { x: 100, y: 0 };
    const view = zoomAt({ frame, point, scale: 2, view: FIT });

    // The spot was 100 right of the middle on the fitted picture; at twice the size it's 200 in,
    // so the picture moves 100 the other way to keep it under the fingers.
    expect(view).toStrictEqual({ scale: 2, x: -100, y: 0 });
  });

  it("never zooms out past fitted or in past the most that helps", () => {
    expect(zoomAt({ frame, point: { x: 0, y: 0 }, scale: 0.5, view: FIT })).toStrictEqual(FIT);
    expect(zoomAt({ frame, point: { x: 0, y: 0 }, scale: 9, view: FIT }).scale).toBe(MAX_SCALE);
  });
});

describe(panBy, () => {
  it("moves a zoomed picture until its edge meets the frame's", () => {
    const zoomed = { scale: 3, x: 0, y: 0 };

    // At three times, the picture is 1170 square: 390 each way in a 390-wide frame, 235 each way in
    // a 700-tall one.
    expect(panBy({ delta: { x: 1000, y: -1000 }, frame, view: zoomed })).toStrictEqual({
      scale: 3,
      x: 390,
      y: -235,
    });
  });

  it("keeps a fitted picture centered", () => {
    expect(panBy({ delta: { x: 40, y: 40 }, frame, view: FIT })).toStrictEqual(FIT);
  });
});

describe(clampPanZoom, () => {
  it("pulls a picture back over its frame after zooming out", () => {
    expect(clampPanZoom({ frame, view: { scale: 1.5, x: 400, y: 0 } })).toStrictEqual({
      scale: 1.5,
      x: 97.5,
      y: 0,
    });
  });
});

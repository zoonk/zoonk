import { describe, expect, it } from "vitest";
import { FIT, MAX_SCALE, clampPanZoom, panBy, zoomAt } from "./pan-zoom";

const frame = { height: 700, width: 390 };

describe(zoomAt, () => {
  it("keeps the spot under the fingers where it was", () => {
    const point = { x: 100, y: 0 };
    const view = zoomAt({ frame, point, scale: 2, view: FIT });

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

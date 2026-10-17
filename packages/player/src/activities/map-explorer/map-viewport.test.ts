import { describe, expect, it } from "vitest";
import { fitViewport, spreadPins } from "./map-viewport";

const map = { height: 500, width: 1000 };

describe(fitViewport, () => {
  it("shows the whole map when there's nothing to frame", () => {
    expect(fitViewport({ map, maxZoom: 4, points: [] })).toStrictEqual({
      height: 500,
      width: 1000,
      x: 0,
      y: 0,
    });
  });

  it("zooms in on clustered places, no further than the map's detail allows", () => {
    const box = fitViewport({
      map,
      maxZoom: 4,
      points: [
        { x: 600, y: 200 },
        { x: 610, y: 205 },
      ],
    });

    expect(box.width).toBeGreaterThanOrEqual(250);
    expect(box.width).toBeLessThan(1000);
    expect(box.x).toBeLessThan(600);
    expect(box.x + box.width).toBeGreaterThan(610);
    expect(box.y).toBeLessThan(200);
    expect(box.y + box.height).toBeGreaterThan(205);
  });

  it("keeps a shape a phone can show and stays on the map", () => {
    const box = fitViewport({
      map,
      maxZoom: 4,
      points: [
        { x: 20, y: 20 },
        { x: 980, y: 40 },
      ],
    });

    const aspect = box.height / box.width;

    expect(aspect).toBeLessThanOrEqual(1.05);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(1000);
    expect(box.y + box.height).toBeLessThanOrEqual(500);
  });
});

describe("fitViewport on wide screens", () => {
  it("keeps the map short enough for the screen", () => {
    const box = fitViewport({ map, maxAspect: 0.4, maxZoom: 4, points: [{ x: 500, y: 250 }] });
    expect(box.height / box.width).toBeLessThanOrEqual(0.4);
  });
});

describe(spreadPins, () => {
  const frame = { height: 300, width: 300 };

  it("leaves pins with room alone", () => {
    const points = [
      { x: 50, y: 50 },
      { x: 200, y: 200 },
    ];

    expect(spreadPins({ distance: 40, frame, points })).toStrictEqual(points);
  });

  it("pushes overlapping pins apart until they have room", () => {
    const [first, second] = spreadPins({
      distance: 40,
      frame,
      points: [
        { x: 150, y: 150 },
        { x: 160, y: 150 },
      ],
    });

    expect(
      first && second && Math.hypot(first.x - second.x, first.y - second.y),
    ).toBeGreaterThanOrEqual(39.9);
  });

  it("separates pins in the same spot and keeps them in the frame", () => {
    const spread = spreadPins({
      distance: 40,
      frame,
      points: [
        { x: 5, y: 5 },
        { x: 5, y: 5 },
      ],
    });

    const [first, second] = spread;

    expect(first && second && Math.hypot(first.x - second.x, first.y - second.y)).toBeGreaterThan(
      30,
    );

    expect(spread.every((point) => point.x >= 20 && point.y >= 20)).toBe(true);
  });
});

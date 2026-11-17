import { describe, expect, it } from "vitest";
import { estimatedLabelWidth } from "../_utils/drawing-label";
import {
  type MapLabelSpot,
  type MapPoint,
  fitViewport,
  placeMapLabels,
  spreadPins,
  strayRegions,
} from "./map-viewport";

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

const LABEL_HEIGHT = 12;

function inkOf(label: MapLabelSpot, at: MapPoint) {
  const width = estimatedLabelWidth(label.text);
  const radians = (label.angle * Math.PI) / 180;
  const along = { x: Math.cos(radians), y: Math.sin(radians) };
  const reach = width / 2 - LABEL_HEIGHT / 2;

  return Array.from({ length: 21 }, (_, index) => {
    const t = -reach + (2 * reach * index) / 20;
    return { x: at.x + along.x * t, y: at.y + along.y * t };
  });
}

function gapBetween(first: MapPoint[], second: MapPoint[]): number {
  return Math.min(...first.flatMap((a) => second.map((b) => Math.hypot(a.x - b.x, a.y - b.y))));
}

describe(placeMapLabels, () => {
  const frame = { height: 300, width: 400 };

  it("slides a street's name along its street, off a pin", () => {
    const broad = {
      angle: 0,
      height: 12,
      kind: "street" as const,
      text: "Broad Street",
      width: estimatedLabelWidth("Broad Street"),
      x: 200,
      y: 150,
    };

    const pin = { x: 170, y: 150 };
    const [spot] = placeMapLabels({ frame, labels: [broad], pins: [pin] });

    expect(spot?.y).toBeCloseTo(150);
    expect(spot && gapBetween(inkOf(broad, spot), [pin])).toBeGreaterThan(LABEL_HEIGHT / 2 + 20);
  });

  it("slides a street's name back inside the map where an edge would cut it", () => {
    const wardour = {
      angle: 90,
      height: 12,
      kind: "street" as const,
      text: "Wardour Street",
      width: estimatedLabelWidth("Wardour Street"),
      x: 380,
      y: 290,
    };

    const [spot] = placeMapLabels({ frame, labels: [wardour], pins: [] });
    const lowest = Math.max(...(spot ? inkOf(wardour, spot) : []).map((point) => point.y));

    expect(spot?.x).toBeCloseTo(380);
    expect(lowest + LABEL_HEIGHT / 2).toBeLessThanOrEqual(frame.height);
  });

  it("leaves out a region's name that the map's edge cuts", () => {
    const soho = {
      angle: 0,
      height: 12,
      kind: "region" as const,
      text: "Soho Square",
      width: estimatedLabelWidth("Soho Square"),
      x: 395,
      y: 60,
    };

    expect(placeMapLabels({ frame, labels: [soho], pins: [] })).toStrictEqual([null]);
  });

  it("keeps two names from running into each other", () => {
    const oxford = {
      angle: -8,
      height: 12,
      kind: "street" as const,
      text: "Oxford Street",
      width: estimatedLabelWidth("Oxford Street"),
      x: 150,
      y: 50,
    };

    const berwick = {
      angle: 88,
      height: 12,
      kind: "street" as const,
      text: "Berwick Street",
      width: estimatedLabelWidth("Berwick Street"),
      x: 196,
      y: 80,
    };

    const [first, second] = placeMapLabels({ frame, labels: [oxford, berwick], pins: [] });

    const gap = second ? gapBetween(inkOf(oxford, first ?? oxford), inkOf(berwick, second)) : 0;

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(gap).toBeGreaterThan(LABEL_HEIGHT);
  });
});

describe(strayRegions, () => {
  const regions = [
    { id: "soho", name: "Soho", tone: "context" },
    { id: "golden-square", name: "Golden Square", tone: "groupC" },
    { id: "soho-square", name: "Soho Square", tone: "groupC" },
  ];

  const labels = [
    { kind: "region" as const, text: "Golden Square" },
    { kind: "region" as const, text: "Soho Square" },
    { kind: "street" as const, text: "Oxford Street" },
  ];

  it("leaves out a tinted region whose name has no room on the map", () => {
    const spots = [{ x: 10, y: 10 }, null, { x: 50, y: 50 }];

    expect(strayRegions({ labels, legendTones: [], regions, spots })).toStrictEqual([
      "soho-square",
    ]);
  });

  it("keeps a region's tint when the legend says what it means", () => {
    const spots = [{ x: 10, y: 10 }, null, { x: 50, y: 50 }];

    expect(strayRegions({ labels, legendTones: ["groupC"], regions, spots })).toStrictEqual([]);
  });
});

describe("measured map labels", () => {
  it("a dropped measured label frees its space, and no second edge margin hides a fitting label", () => {
    const labels = [
      { angle: 0, height: 12, kind: "region" as const, text: "Wide", width: 500, x: 100, y: 100 },
      { angle: 0, height: 12, kind: "region" as const, text: "Soho", width: 40, x: 100, y: 100 },
      { angle: 0, height: 12, kind: "region" as const, text: "Edge", width: 20, x: 12, y: 30 },
    ];

    expect(placeMapLabels({ frame: { height: 200, width: 210 }, labels, pins: [] })).toStrictEqual([
      null,
      { x: 100, y: 100 },
      { x: 12, y: 30 },
    ]);
  });

  it("moves a named street off its pin before placing an optional name", () => {
    const labels = [
      {
        angle: 0,
        height: 12,
        kind: "region" as const,
        priority: false,
        text: "Park",
        width: 80,
        x: 138,
        y: 100,
      },
      {
        angle: 0,
        height: 12,
        kind: "street" as const,
        priority: true,
        text: "Broad Street",
        width: 80,
        x: 70,
        y: 100,
      },
    ];

    const spots = placeMapLabels({
      frame: { height: 200, width: 210 },
      labels,
      pins: [{ x: 70, y: 100 }],
    });

    expect(spots[1]).not.toBeNull();
    expect(spots[1]?.x).toBeGreaterThan(130);
    expect(spots[0]).toBeNull();
  });
});

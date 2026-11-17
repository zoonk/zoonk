import { describe, expect, it } from "vitest";
import { estimatedLabelWidth } from "../_utils/drawing-label";
import { type MapLabelSpot, isMapLabelNamed, placeMapLabels } from "./map-labels";
import { type MapPoint, fitViewport, spreadPins, strayRegions } from "./map-viewport";

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
  const named = {
    angle: 0,
    height: 12,
    kind: "street" as const,
    positions: [{ x: 160, y: 120 }],
    priority: true,
    text: "Broad Street",
    width: 80,
    x: 160,
    y: 120,
  };

  it("keeps a named street beside its own path at normal and 200 percent text", () => {
    for (const width of [100, 200]) {
      const broad = {
        ...named,
        height: width * 0.12,
        positions: [
          { x: 20, y: 120 },
          { x: 300, y: 120 },
        ],
        width,
      };

      const oxford = {
        ...broad,
        positions: [
          { x: 20, y: 83 },
          { x: 300, y: 83 },
        ],
        priority: false,
        y: 83,
      };

      const [spot] = placeMapLabels({
        frame: { height: 240, width: 320 },
        labels: [broad, oxford],
        pins: [{ x: 160, y: 120 }],
      });

      expect(spot).not.toBeNull();
      expect(Math.abs(spot!.y - 120)).toBeLessThanOrEqual(40);
      expect(Math.abs(spot!.y - 120)).toBeLessThan(Math.abs(spot!.y - 83));
      const scale = spot!.scale ?? 1;

      expect(
        Math.abs(spot!.x - 160) >= (width * scale) / 2 + 20 ||
          Math.abs(spot!.y - 120) >= (broad.height * scale) / 2 + 20,
      ).toBe(true);
    }
  });

  it("keeps 192 px and widened street frames readable, using only number clearance as a last resort", () => {
    for (const width of [192, 320]) {
      const center = { x: width / 2, y: 90 };

      const labels = [90, 25, 155].map((y, index) => ({
        ...named,
        height: 24,
        positions: [
          { x: 0, y },
          { x: width, y },
        ],
        priority: index === 0,
        width: 120,
        x: center.x,
        y,
      }));

      const [spot] = placeMapLabels({
        frame: { height: 180, width },
        labels,
        pinNumbers: [{ height: 20, width: 16, x: center.x - 8, y: 80 }],
        pins: [center],
      });

      expect(spot).not.toBeNull();
      expect(Math.abs(spot!.y - 90)).toBeLessThanOrEqual(40);

      expect(Math.abs(spot!.y - 90)).toBeLessThan(
        Math.min(Math.abs(spot!.y - 25), Math.abs(spot!.y - 155)),
      );

      const scale = spot!.scale ?? 1;

      expect(
        Math.abs(spot!.x - center.x) >= 60 * scale + 8 || Math.abs(spot!.y - 90) >= 12 * scale + 10,
      ).toBe(true);

      expect(Boolean(spot!.overPinCircle)).toBe(width === 192);
      expect(scale).toBe(width === 192 ? 0.8 : 1);
    }
  });

  it("keeps a named label box clear of every pin box", () => {
    const pins = [
      { x: 160, y: 120 },
      { x: 190, y: 155 },
    ];

    const [spot] = placeMapLabels({
      frame: { height: 240, width: 320 },
      labels: [
        {
          ...named,
          positions: [
            { x: 150, y: 120 },
            { x: 170, y: 120 },
          ],
        },
      ],
      pins,
    });

    expect(spot).not.toBeNull();

    for (const pin of pins) {
      expect(Math.abs(spot!.x - pin.x) >= 40 + 20 || Math.abs(spot!.y - pin.y) >= 6 + 20).toBe(
        true,
      );
    }
  });

  it("packs three named region boxes without overlaps in a short frame", () => {
    const labels = Array.from({ length: 3 }, () => ({
      ...named,
      kind: "region" as const,
      width: 110,
      x: 100,
      y: 20,
    }));

    const spots = placeMapLabels({ frame: { height: 40, width: 200 }, labels, pins: [] });
    expect(spots.every(Boolean)).toBe(true);

    for (let i = 0; i < spots.length; i += 1) {
      for (let j = i + 1; j < spots.length; j += 1) {
        expect(
          Math.abs(spots[i]!.x - spots[j]!.x) >=
            55 * ((spots[i]!.scale ?? 1) + (spots[j]!.scale ?? 1)) ||
            Math.abs(spots[i]!.y - spots[j]!.y) >=
              6 * ((spots[i]!.scale ?? 1) + (spots[j]!.scale ?? 1)),
        ).toBe(true);
      }
    }
  });

  it("keeps a question name before answer-only names when the minimum cannot fit them all", () => {
    const labels = [
      { ...named, kind: "region" as const, width: 110, x: 50, y: 10 },
      { ...named, kind: "region" as const, question: true, width: 110, x: 50, y: 10 },
    ];

    const spots = placeMapLabels({ frame: { height: 20, width: 100 }, labels, pins: [] });
    expect(spots[0]).toBeNull();
    expect(spots[1]).not.toBeNull();
    expect(spots[1]!.scale).toBeGreaterThanOrEqual(0.8);
  });

  it("keeps a named street even when its only spot is under a pin", () => {
    expect(
      placeMapLabels({
        frame: { height: 240, width: 320 },
        labels: [named],
        pins: [{ x: 160, y: 120 }],
      })[0],
    ).not.toBeNull();
  });

  it("keeps two named labels on one segment readable", () => {
    const spots = placeMapLabels({
      frame: { height: 240, width: 320 },
      labels: [named, { ...named, text: "Wardour Street" }],
      pins: [],
    });

    expect(spots.every(Boolean)).toBe(true);
    expect(spots[0]).not.toStrictEqual(spots[1]);
  });

  it("keeps a named region even when a pin covers its spot", () => {
    expect(
      placeMapLabels({
        frame: { height: 240, width: 320 },
        labels: [{ ...named, kind: "region" }],
        pins: [{ x: 160, y: 120 }],
      })[0],
    ).not.toBeNull();
  });

  it("hides a street name when avoiding its pin would move it beyond the drawn street", () => {
    const [spot] = placeMapLabels({
      frame: { height: 250, width: 210 },
      labels: [
        {
          angle: 90,
          height: 12,
          kind: "street",
          positions: [
            { x: 70, y: 50 },
            { x: 70, y: 120 },
          ],
          text: "Poland Street",
          width: 80,
          x: 70,
          y: 100,
        },
      ],
      pins: [{ x: 70, y: 100 }],
    });

    expect(spot).toBeNull();
  });

  it("slides a street farther than its text width when the visible part has room", () => {
    const [spot] = placeMapLabels({
      frame: { height: 200, width: 210 },
      labels: [
        {
          angle: 90,
          height: 12,
          kind: "street",
          positions: [
            { x: 70, y: 50 },
            { x: 70, y: 124 },
            { x: 70, y: 300 },
          ],
          text: "Wardour Street",
          width: 80,
          x: 70,
          y: 300,
        },
      ],
      pins: [{ x: 70, y: 190 }],
    });

    expect(spot).not.toBeNull();
    expect(spot!.y).toBeLessThan(130);
  });

  const frame = { height: 300, width: 400 };

  it("slides a street's name along its street, off a pin", () => {
    const broad = {
      angle: 0,
      height: 12,
      kind: "street" as const,
      positions: [
        { x: 200, y: 150 },
        { x: 240, y: 150 },
      ],
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
      positions: [
        { x: 380, y: 290 },
        { x: 380, y: 200 },
      ],
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
      positions: [{ x: 150, y: 50 }],
      text: "Oxford Street",
      width: estimatedLabelWidth("Oxford Street"),
      x: 150,
      y: 50,
    };

    const berwick = {
      angle: 88,
      height: 12,
      kind: "street" as const,
      positions: [
        { x: 196, y: 80 },
        { x: 196, y: 150 },
      ],
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
        positions: [
          { x: 70, y: 100 },
          { x: 138, y: 100 },
        ],
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

describe(isMapLabelNamed, () => {
  it("matches the source or translated name in a Portuguese course", () => {
    for (const references of ["Onde fica a América do Norte?", "Onde fica North America?"]) {
      expect(
        isMapLabelNamed({ references, source: "North America", text: "América do Norte" }),
      ).toBe(true);
    }

    expect(
      isMapLabelNamed({
        references: "Onde fica a Europa?",
        source: "North America",
        text: "América do Norte",
      }),
    ).toBe(false);
  });
});

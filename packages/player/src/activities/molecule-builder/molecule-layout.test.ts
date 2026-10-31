import { describe, expect, it } from "vitest";
import {
  ATOM_RADIUS,
  type Layout,
  layoutBuild,
  placeNewAtom,
  settleLayout,
} from "./molecule-layout";

const size = { height: 240, width: 320 };

function atomsOf(layout: Layout): { id: string }[] {
  return Object.keys(layout).map((id) => ({ id }));
}

function distance(layout: Layout, first: string, second: string): number {
  const [a, b] = [layout[first], layout[second]];
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : Number.NaN;
}

function grow(
  steps: readonly { anchor: string | null; id: string }[],
  layout: Layout = {},
): Layout {
  const [step, ...rest] = steps;

  if (!step) {
    return layout;
  }

  return grow(rest, { ...layout, [step.id]: placeNewAtom({ anchor: step.anchor, layout, size }) });
}

describe(placeNewAtom, () => {
  it("puts the first atom in the middle and the next ones beside their anchor", () => {
    const layout = grow([
      { anchor: null, id: "c1" },
      { anchor: "c1", id: "o1" },
      { anchor: "c1", id: "o2" },
    ]);

    expect(layout.c1).toStrictEqual({ x: 160, y: 120 });
    expect(distance(layout, "c1", "o1")).toBeCloseTo(68, 0);
    expect(distance(layout, "o1", "o2")).toBeGreaterThan(100);
  });

  it("puts an unbonded atom where there's room", () => {
    const layout = grow([
      { anchor: null, id: "c1" },
      { anchor: null, id: "h1" },
    ]);

    expect(distance(layout, "c1", "h1")).toBeGreaterThan(ATOM_RADIUS * 4);
  });
});

describe(settleLayout, () => {
  it("keeps methane's bonds even, its atoms apart and everything on the canvas", () => {
    const ids = ["h1", "h2", "h3", "h4"];
    const bonds = ids.map((id) => ({ from: "c1", to: id }));
    const start = grow([{ anchor: null, id: "c1" }, ...ids.map((id) => ({ anchor: "c1", id }))]);
    const layout = settleLayout({ atoms: atomsOf(start), bonds, layout: start });

    for (const id of ids) {
      expect(distance(layout, "c1", id)).toBeGreaterThan(50);
      expect(distance(layout, "c1", id)).toBeLessThan(110);
    }

    const all = ["c1", ...ids];

    for (const [index, first] of all.entries()) {
      for (const second of all.slice(index + 1)) {
        expect(distance(layout, first, second)).toBeGreaterThan(ATOM_RADIUS * 2);
      }
    }

    for (const point of Object.values(layout)) {
      expect(point.x).toBeGreaterThanOrEqual(ATOM_RADIUS);
      expect(point.x).toBeLessThanOrEqual(size.width - ATOM_RADIUS);
      expect(point.y).toBeGreaterThanOrEqual(ATOM_RADIUS);
      expect(point.y).toBeLessThanOrEqual(size.height - ATOM_RADIUS);
    }
  });

  it("separates atoms that start on top of each other and gives the same result every time", () => {
    const start = { a: { x: 100, y: 100 }, b: { x: 100, y: 100 } };
    const layout = settleLayout({ atoms: atomsOf(start), bonds: [], layout: start });

    expect(distance(layout, "a", "b")).toBeGreaterThan(ATOM_RADIUS * 2);
    expect(settleLayout({ atoms: atomsOf(start), bonds: [], layout: start })).toStrictEqual(layout);
  });
});

describe(layoutBuild, () => {
  it("lays out a whole build with every bonded pair close and every atom apart", () => {
    const atoms = ["c1", "o1", "o2"].map((id) => ({ id }));

    const bonds = [
      { from: "c1", to: "o1" },
      { from: "c1", to: "o2" },
    ];

    const layout = layoutBuild({ atoms, bonds, size });

    expect(distance(layout, "c1", "o1")).toBeLessThan(110);
    expect(distance(layout, "c1", "o2")).toBeLessThan(110);
    expect(distance(layout, "o1", "o2")).toBeGreaterThan(ATOM_RADIUS * 2);
  });
});

describe(settleLayout, () => {
  it("lets a removed atom's old place push nothing", () => {
    const atoms = [{ id: "c1" }, { id: "o1" }];
    const bonds = [{ from: "c1", to: "o1" }];
    const layout = { c1: { x: 150, y: 120 }, o1: { x: 210, y: 120 } };

    const withRemoved = settleLayout({
      atoms,
      bonds,
      layout: { ...layout, h1: { x: 170, y: 125 } },
    });

    expect(withRemoved).toStrictEqual(settleLayout({ atoms, bonds, layout }));
    expect(withRemoved).not.toHaveProperty("h1");
  });
});

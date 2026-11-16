import { describe, expect, it } from "vitest";
import { arcEndOffsets, arcPath, compareLinks, orderNodes, toggleLink } from "./cause-effect-links";

describe(orderNodes, () => {
  it("orders dated nodes by year", () => {
    const nodes = [
      { id: "dust", year: 1934 },
      { id: "plow", year: 1920 },
      { id: "drought", year: 1931 },
    ];

    expect(orderNodes(nodes).map((node) => node.id)).toStrictEqual(["plow", "drought", "dust"]);
  });

  it("keeps the writer's order when a node has no date", () => {
    const nodes = [{ id: "b", year: 1934 }, { id: "a" }];
    expect(orderNodes(nodes).map((node) => node.id)).toStrictEqual(["b", "a"]);
  });
});

describe(toggleLink, () => {
  it("adds a new link and removes an existing one", () => {
    const added = toggleLink([], { from: "plow", to: "dust" });

    expect(added).toStrictEqual([{ from: "plow", to: "dust" }]);
    expect(toggleLink(added, { from: "plow", to: "dust" })).toStrictEqual([]);
  });

  it("treats a reversed link as a different one", () => {
    expect(toggleLink([{ from: "a", to: "b" }], { from: "b", to: "a" })).toHaveLength(2);
  });
});

describe(compareLinks, () => {
  it("marks right and wrong links and lists the missed ones", () => {
    const expected = [
      { from: "plow", to: "dust" },
      { from: "drought", to: "dust" },
    ];

    expect(
      compareLinks(
        [
          { from: "plow", to: "dust" },
          { from: "dust", to: "plow" },
        ],
        expected,
      ),
    ).toStrictEqual([
      { from: "plow", state: "correct", to: "dust" },
      { from: "dust", state: "incorrect", to: "plow" },
      { from: "drought", state: "missed", to: "dust" },
    ]);
  });
});

describe(arcPath, () => {
  it("bows further left for cards further apart, within the gutter", () => {
    expect(arcPath({ from: 20, gutter: 48, span: 1, to: 80 })).toBe("M48 20 C34 20 34 80 48 80");
    expect(arcPath({ from: 20, gutter: 48, span: 3, to: 200 })).toBe("M48 20 C20 20 20 200 48 200");
    expect(arcPath({ from: 20, gutter: 48, span: 9, to: 400 })).toBe("M48 20 C2 20 2 400 48 400");
  });

  it("stops the arrow short of the effect's card by its head's reach, so the tip meets the border", () => {
    expect(arcPath({ from: 20, gutter: 48, headReach: 3.5, span: 1, to: 80 })).toBe(
      "M48 20 C34 20 34 80 44.5 80",
    );
  });
});

describe(arcEndOffsets, () => {
  const order = ["plow", "drought", "storms"];

  const intoStorms = [
    { from: "plow", to: "storms" },
    { from: "drought", to: "storms" },
  ];

  it("ends arrows into one card a head apart, the one from farther away lower so they nest", () => {
    expect(
      arcEndOffsets({
        base: 5,
        cards: { storms: { half: 31 } },
        headHeight: 14,
        links: intoStorms,
        order,
      }),
    ).toStrictEqual([21, 5]);
  });

  it("ends arrows from above over arrows from below", () => {
    const intoDrought = [
      { from: "storms", to: "drought" },
      { from: "plow", to: "drought" },
    ];

    expect(
      arcEndOffsets({
        base: 5,
        cards: { drought: { half: 31 } },
        headHeight: 14,
        links: intoDrought,
        order,
      }),
    ).toStrictEqual([21, 5]);
  });

  it("keeps every head beside a short card, closer together", () => {
    expect(
      arcEndOffsets({
        base: 5,
        cards: { storms: { half: 20 } },
        headHeight: 14,
        links: intoStorms,
        order,
      }),
    ).toStrictEqual([13, 5]);
  });

  it("ends a lone arrow at the base", () => {
    expect(
      arcEndOffsets({
        base: 5,
        cards: { drought: { half: 31 }, storms: { half: 31 } },
        headHeight: 14,
        links: [
          { from: "plow", to: "drought" },
          { from: "drought", to: "storms" },
        ],
        order,
      }),
    ).toStrictEqual([5, 5]);
  });
});

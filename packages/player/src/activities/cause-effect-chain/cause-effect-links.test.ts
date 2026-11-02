import { describe, expect, it } from "vitest";
import { arcPath, compareLinks, orderNodes, toggleLink } from "./cause-effect-links";

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
});

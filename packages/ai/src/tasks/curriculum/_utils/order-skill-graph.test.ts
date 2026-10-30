import { describe, expect, it } from "vitest";
import {
  pushPhasesAfterPrerequisites,
  removeCycles,
  sortSkillsTopologically,
} from "./order-skill-graph";

function node(key: string, prerequisites: string[] = [], phase = 1) {
  return { key, phase, prerequisites };
}

describe(removeCycles, () => {
  it("drops only the edge that closes a cycle, in the order skills were listed", () => {
    const nodes = [node("a", ["c"]), node("b", ["a"]), node("c", ["b"]), node("d", ["a", "c"])];

    expect(removeCycles(nodes)).toStrictEqual([
      node("a", ["c"]),
      node("b", []),
      node("c", ["b"]),
      node("d", ["a", "c"]),
    ]);
  });

  it("drops a skill that requires itself", () => {
    expect(removeCycles([node("a", ["a"])])).toStrictEqual([node("a", [])]);
  });
});

describe(pushPhasesAfterPrerequisites, () => {
  it("moves a skill to the latest phase among its prerequisites", () => {
    const nodes = [node("a", [], 3), node("b", ["a"], 1), node("c", ["b"], 2)];

    expect(pushPhasesAfterPrerequisites(nodes).map((item) => item.phase)).toStrictEqual([3, 3, 3]);
  });

  it("keeps a skill that already comes after its prerequisites", () => {
    const nodes = [node("a", [], 1), node("b", ["a"], 2)];

    expect(pushPhasesAfterPrerequisites(nodes)).toStrictEqual(nodes);
  });
});

describe(sortSkillsTopologically, () => {
  it("puts prerequisites first and otherwise keeps phase and listed order", () => {
    const nodes = [
      node("vectors", ["algebra"], 1),
      node("calculus", ["functions"], 2),
      node("algebra", [], 1),
      node("functions", ["algebra"], 1),
      node("mechanics", ["calculus", "vectors"], 2),
    ];

    expect(sortSkillsTopologically(nodes).map((item) => item.key)).toStrictEqual([
      "algebra",
      "vectors",
      "functions",
      "calculus",
      "mechanics",
    ]);
  });
});

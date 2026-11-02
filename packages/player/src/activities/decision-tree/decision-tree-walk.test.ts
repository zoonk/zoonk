import { describe, expect, it } from "vitest";
import { firstDivergence, reachableOutcomes, walkSteps } from "./decision-tree-walk";

const nodes = [
  {
    branches: [
      { label: "Needles", next: "q2" },
      { label: "Broad leaves", next: "oak" },
    ],
    id: "q1",
    kind: "question" as const,
    question: "What are the leaves like?",
  },
  {
    branches: [
      { label: "In bundles", next: "pine" },
      { label: "Single", next: "spruce" },
    ],
    id: "q2",
    kind: "question" as const,
    question: "How do the needles grow?",
  },
  { id: "pine", kind: "outcome" as const, label: "Pine" },
  { id: "spruce", kind: "outcome" as const, label: "Spruce" },
  { id: "oak", kind: "outcome" as const, label: "Oak" },
];

function labels(id: string) {
  return reachableOutcomes(nodes, id).map((node) => (node.kind === "outcome" ? node.label : ""));
}

describe(reachableOutcomes, () => {
  it("narrows the outcomes as the walk goes down the tree", () => {
    expect(labels("q1")).toStrictEqual(["Pine", "Spruce", "Oak"]);
    expect(labels("q2")).toStrictEqual(["Pine", "Spruce"]);
    expect(labels("oak")).toStrictEqual(["Oak"]);
  });
});

describe(walkSteps, () => {
  it("pairs each answered question with the branch taken", () => {
    expect(
      walkSteps(nodes, ["q1", "q2", "spruce"]).map((step) => [step.node.id, step.branch]),
    ).toStrictEqual([
      ["q1", "Needles"],
      ["q2", "Single"],
    ]);
  });
});

describe(firstDivergence, () => {
  it("finds where the walk left the expected path", () => {
    expect(firstDivergence(["q1", "q2", "pine"], ["q1", "q2", "pine"])).toBeNull();
    expect(firstDivergence(["q1", "q2", "pine"], ["q1", "q2", "spruce"])).toBe(2);
    expect(firstDivergence(["q1", "q2", "pine"], ["q1", "oak"])).toBe(1);
  });
});

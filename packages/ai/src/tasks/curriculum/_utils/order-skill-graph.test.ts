import { describe, expect, it } from "vitest";
import {
  orderSkillGraph,
  pushPhasesAfterPrerequisites,
  removeCycles,
  sortSkillsTopologically,
} from "./order-skill-graph";

function node(key: string, prerequisites: string[] = [], phase = 1) {
  return { key, phase, prerequisites };
}

function ancestors(key: string, nodes: readonly ReturnType<typeof node>[]): string[] {
  const required = nodes.find((item) => item.key === key)?.prerequisites ?? [];
  return [...new Set(required.flatMap((id) => [id, ...ancestors(id, nodes)]))];
}

describe(orderSkillGraph, () => {
  it("keeps the existing order when no courses supply supporting skills", () => {
    const nodes = [node("formal", ["base"], 1), node("other", [], 1), node("base", [], 2)];

    expect(orderSkillGraph({ nodes, supporting: new Set() })).toStrictEqual(
      sortSkillsTopologically(pushPhasesAfterPrerequisites(removeCycles(nodes))),
    );
  });

  it("brings a shared supporting chain in once, at its first subject use", () => {
    const nodes = [
      node("intro"),
      node("base"),
      node("tool", ["base"]),
      node("first-use", ["tool"], 2),
      node("later-use", ["tool"], 3),
    ];

    expect(orderSkillGraph({ nodes, supporting: new Set(["base", "tool"]) })).toStrictEqual([
      node("intro"),
      node("base", [], 2),
      node("tool", ["base"], 2),
      node("first-use", ["tool"], 2),
      node("later-use", ["tool"], 3),
    ]);
  });

  it("keeps unreferenced support and moves it when its own prerequisite defers", () => {
    const nodes = [
      node("intro"),
      node("base"),
      node("unreferenced", ["base"]),
      node("application", ["base"], 2),
    ];

    expect(orderSkillGraph({ nodes, supporting: new Set(["base", "unreferenced"]) })).toStrictEqual(
      [
        node("intro"),
        node("base", [], 2),
        node("application", ["base"], 2),
        node("unreferenced", ["base"], 2),
      ],
    );
  });

  it("preserves every skill, dependency and subject stage across small acyclic graphs", () => {
    const keys = ["a", "b", "c", "d"];

    const possibleEdges = keys.flatMap((key, index) =>
      keys.slice(0, index).map((required) => ({ key, required })),
    );

    const phasePatterns = [
      [1, 1, 1, 1],
      [1, 1, 2, 2],
      [1, 2, 3, 4],
    ];

    Array.from({ length: 2 ** possibleEdges.length }, (_, mask) => mask).forEach((edgeMask) => {
      const edges = possibleEdges.filter((_, index) => Math.floor(edgeMask / 2 ** index) % 2 === 1);

      Array.from({ length: 2 ** (keys.length - 1) }, (_, mask) => mask).forEach((roleMask) => {
        const supporting = new Set(
          keys.filter((_, index) => index > 0 && Math.floor(roleMask / 2 ** (index - 1)) % 2 === 1),
        );

        phasePatterns.forEach((phases) => {
          const nodes = keys.map((key, index) =>
            node(
              key,
              edges.filter((edge) => edge.key === key).map((edge) => edge.required),
              phases[index],
            ),
          );

          const ordered = orderSkillGraph({ nodes, supporting });
          const positions = new Map(ordered.map((item, index) => [item.key, index]));
          const phaseOf = new Map(ordered.map((item) => [item.key, item.phase]));
          const subjects = nodes.filter((item) => !supporting.has(item.key));

          expect(ordered.map((item) => item.key).toSorted()).toStrictEqual(keys);
          expect(ordered.filter((item) => !supporting.has(item.key))).toStrictEqual(subjects);
          expect(sortSkillsTopologically(ordered)).toStrictEqual(ordered);
          expect(orderSkillGraph({ nodes: ordered, supporting })).toStrictEqual(ordered);

          ordered.forEach((item) => {
            expect(item.prerequisites).toStrictEqual(
              nodes.find((original) => original.key === item.key)?.prerequisites,
            );

            item.prerequisites.forEach((required) => {
              expect(positions.get(required)).toBeLessThan(positions.get(item.key) ?? -1);
              expect(phaseOf.get(required)).toBeLessThanOrEqual(item.phase);
            });
          });

          const firstUses = new Map<string, ReturnType<typeof node>>();

          subjects.toReversed().forEach((subject) => {
            ancestors(subject.key, nodes)
              .filter((key) => supporting.has(key))
              .forEach((key) => firstUses.set(key, subject));
          });

          [...firstUses].forEach(([key, first]) => {
            expect(phaseOf.get(key)).toBe(first.phase);

            expect(
              ordered
                .slice((positions.get(key) ?? 0) + 1, positions.get(first.key))
                .filter((between) => !supporting.has(between.key)),
            ).toStrictEqual([]);
          });
        });
      });
    });
  });
});

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

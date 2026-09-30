import { describe, expect, it } from "vitest";
import { toSkillMapEdges, toSkillMapLayers } from "./skill-map-layers";

function skill(skillId: string, prerequisiteIds: string[] = []) {
  return { prerequisiteIds, skillId };
}

const ids = (rows: { skillId: string }[][]) => rows.map((row) => row.map((node) => node.skillId));

describe(toSkillMapLayers, () => {
  it("puts each skill one row below the deepest skill it needs", () => {
    const layers = toSkillMapLayers([
      skill("atom"),
      skill("nucleus"),
      skill("orbital", ["atom"]),
      skill("energy", ["orbital", "nucleus"]),
      skill("colors", ["atom"]),
    ]);

    expect(ids(layers)).toStrictEqual([["atom", "nucleus"], ["orbital", "colors"], ["energy"]]);
  });

  it("places a skill below what it needs, whatever order the skills come in", () => {
    const layers = toSkillMapLayers([
      skill("fractions", ["numbers"]),
      skill("percent", ["ratio"]),
      skill("ratio", ["fractions"]),
    ]);

    expect(ids(layers)).toStrictEqual([["fractions"], ["ratio"], ["percent"]]);
  });

  it("cuts a loop in the graph instead of looping forever", () => {
    const layers = toSkillMapLayers([skill("a", ["b"]), skill("b", ["a"]), skill("c", ["c"])]);

    expect(
      layers
        .flat()
        .map((node) => node.skillId)
        .toSorted(),
    ).toStrictEqual(["a", "b", "c"]);
  });

  it("has no rows for an empty map", () => {
    expect(toSkillMapLayers([])).toStrictEqual([]);
  });
});

describe(toSkillMapEdges, () => {
  it("links the root to skills that need nothing on the map, and each skill to what it needs", () => {
    const edges = toSkillMapEdges({
      rootId: "root",
      skills: [skill("atom", ["outside"]), skill("orbital", ["atom"]), skill("self", ["self"])],
    });

    expect(edges).toStrictEqual([
      { from: "root", to: "atom" },
      { from: "atom", to: "orbital" },
      { from: "root", to: "self" },
    ]);
  });
});

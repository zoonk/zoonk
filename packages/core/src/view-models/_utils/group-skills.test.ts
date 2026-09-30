import { describe, expect, it } from "vitest";
import { groupSkillsByArea, groupSkillsBySection } from "./group-skills";

const skill = (
  areaId: string | null,
  state: "learning" | "mastered" | "new" | "solid",
  fading = false,
) => ({ areaId, areaTitle: areaId ? `Area ${areaId}` : null, fading, state });

describe(groupSkillsByArea, () => {
  it("keeps areas in the order they first appear, with counts per area", () => {
    const groups = groupSkillsByArea([
      skill("b", "mastered"),
      skill("a", "learning", true),
      skill("b", "new"),
      skill("a", "solid"),
    ]);

    expect(groups.map((group) => group.areaId)).toStrictEqual(["b", "a"]);

    expect(groups[0]).toMatchObject({
      counts: { fading: 0, mastered: 1, new: 1, total: 2 },
      title: "Area b",
    });

    expect(groups[1]?.counts).toMatchObject({ fading: 1, learning: 1, solid: 1, total: 2 });
  });

  it("puts skills without an area in one group", () => {
    const groups = groupSkillsByArea([skill(null, "new"), skill(null, "learning")]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ areaId: "other", counts: { total: 2 }, title: "" });
  });
});

const inSection = (areaId: string, sectionTitle: string | null) => ({
  ...skill(areaId, "new"),
  sectionTitle,
});

describe(groupSkillsBySection, () => {
  it("keeps each section's areas together, in the order sections and areas first appear", () => {
    const groups = groupSkillsBySection([
      inSection("algebra", "Math"),
      inSection("cells", "Science"),
      inSection("geometry", "Math"),
      inSection("algebra", "Math"),
      inSection("energy", "Science"),
    ]);

    expect(groups.map((group) => [group.section, group.areaId, group.counts.total])).toStrictEqual([
      ["Math", "algebra", 2],
      ["Math", "geometry", 1],
      ["Science", "cells", 1],
      ["Science", "energy", 1],
    ]);
  });

  it("leaves areas without a section in plan order, with no section", () => {
    const groups = groupSkillsBySection([inSection("b", null), inSection("a", null)]);

    expect(groups.map((group) => [group.section, group.areaId])).toStrictEqual([
      [null, "b"],
      [null, "a"],
    ]);
  });
});

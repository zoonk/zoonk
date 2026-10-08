import { type MasteryState } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { buildStillNeeded } from "./still-needed";

function skill(skillId: string, areaId: string, state: MasteryState) {
  return { areaId, areaTitle: `Area ${areaId}`, name: `Skill ${skillId}`, skillId, state };
}

const skills = [
  skill("a1", "a", "new"),
  skill("a2", "a", "learning"),
  skill("a3", "a", "solid"),
  skill("b1", "b", "mastered"),
  skill("b2", "b", "learning"),
];

describe(buildStillNeeded, () => {
  it("lists every skill below Solid by area in plan order, keeping areas already there", () => {
    const needed = buildStillNeeded({
      goalKind: "learn",
      skills: [...skills, skill("c1", "c", "solid")],
      weights: new Map(),
      work: [],
    });

    expect(needed.rule).toBe("solid");
    expect(needed.left).toBe(3);

    expect(needed.areas.map((area) => [area.areaId, area.left.length, area.total])).toStrictEqual([
      ["a", 2, 3],
      ["b", 1, 2],
      ["c", 0, 1],
    ]);

    expect(needed.areas[0]?.left).toStrictEqual([
      { name: "Skill a1", skillId: "a1" },
      { name: "Skill a2", skillId: "a2" },
    ]);
  });

  it("asks exam goals for Solid only on skills weighted 4 or more, and Learning for the rest", () => {
    const needed = buildStillNeeded({
      goalKind: "exam",
      skills: [...skills, skill("b3", "b", "learning")],
      weights: new Map([
        ["a1", 1],
        ["a2", 4],
        ["a3", 5],
        ["b3", 3],
      ]),
      work: [],
    });

    expect(needed.rule).toBe("examWeighted");

    // a1 is new (below Learning) and a2 weighs 4 but is only Learning; b3 (weight 3) and b2 (no
    // weight) only need Learning.
    expect(needed.areas.flatMap((area) => area.left.map((item) => item.skillId))).toStrictEqual([
      "a1",
      "a2",
    ]);
  });

  it("gives each needed skill its share of the plan's remaining time", () => {
    const needed = buildStillNeeded({
      goalKind: "learn",
      skills,
      weights: new Map(),
      work: [
        { minutes: 30, skillIds: ["a1", "a3"] },
        { minutes: 12, skillIds: ["a2"] },
        { minutes: 20, skillIds: ["b1", "b2"] },
      ],
    });

    // a1 gets half of the first item (a3 is already Solid), a2 all of the second, b2 half the third.
    expect(needed.areas.map((area) => area.minutes)).toStrictEqual([27, 10]);
    expect(needed.minutes).toBe(37);
  });

  it("puts skills outside a plan area in one row and is empty without skills", () => {
    const outside = buildStillNeeded({
      goalKind: "learn",
      skills: [{ ...skill("x", "x", "new"), areaId: null, areaTitle: null }],
      weights: new Map(),
      work: [],
    });

    expect(outside.areas).toStrictEqual([
      {
        areaId: "other",
        left: [{ name: "Skill x", skillId: "x" }],
        minutes: 0,
        title: "",
        total: 1,
      },
    ]);

    expect(
      buildStillNeeded({ goalKind: "learn", skills: [], weights: new Map(), work: [] }),
    ).toStrictEqual({ areas: [], left: 0, minutes: 0, rule: "solid" });
  });
});

import { describe, expect, it } from "vitest";
import { getRisenSkills } from "./risen-skills";

const move = (
  skillId: string,
  from: "learning" | "mastered" | "new" | "solid",
  to: typeof from,
) => ({ from, name: skillId, skillId, to });

describe(getRisenSkills, () => {
  it("names the skills that went up a state, the first two", () => {
    expect(
      getRisenSkills([
        move("ratios", "learning", "solid"),
        move("percentages", "solid", "learning"),
        move("discounts", "solid", "mastered"),
        move("fractions", "learning", "mastered"),
      ]).map((rise) => rise.skillId),
    ).toStrictEqual(["ratios", "discounts"]);
  });

  it("names nothing when every skill slipped back or stayed", () => {
    expect(getRisenSkills([move("ratios", "mastered", "solid")])).toStrictEqual([]);
    expect(getRisenSkills([])).toStrictEqual([]);
  });
});

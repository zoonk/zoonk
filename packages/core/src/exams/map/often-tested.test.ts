import { describe, expect, it } from "vitest";
import { getOftenTestedSkillIds } from "./often-tested";

const citation = { passage: "", sourceId: "papers" };

function topic(name: string, level: "high" | "low" | "medium") {
  return { appearances: null, basis: "", citation, level, subject: "Math", topic: name };
}

describe(getOftenTestedSkillIds, () => {
  it("tags skills the board asks a lot, by name or by the graph's weight", () => {
    const ids = getOftenTestedSkillIds({
      frequency: [topic("Percentages", "high"), topic("Functions", "medium")],
      skills: [
        { name: "Percentages", skillId: "a", weight: 2 },
        { name: "Linear functions", skillId: "b", weight: 3 },
        { name: "Reading charts", skillId: "c", weight: 5 },
      ],
    });

    expect([...ids]).toStrictEqual(["a", "c"]);
  });

  it("tags nothing without past-paper frequency", () => {
    expect(
      getOftenTestedSkillIds({
        frequency: [topic("Functions", "medium")],
        skills: [{ name: "Reading charts", skillId: "c", weight: 5 }],
      }).size,
    ).toBe(0);
  });
});

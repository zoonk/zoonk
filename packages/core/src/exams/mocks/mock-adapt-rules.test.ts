import { describe, expect, it } from "vitest";
import { findSkippableItems, findWeakestArea, getAcedSkillIds } from "./mock-adapt-rules";

function topic(skillId: string, correct: number, total: number) {
  return { area: "Math", correct, name: skillId, skillId, total };
}

function lessons(skillId: string, count: number) {
  return Array.from({ length: count }, () => ({ skillIds: [skillId], status: "todo" }));
}

function area(name: string, correct: number, total: number) {
  return {
    correct,
    name,
    score: null,
    secondsPerQuestion: 60,
    targetSecondsPerQuestion: null,
    total,
  };
}

describe(getAcedSkillIds, () => {
  it("vouches for a topic answered right every time, three times or more, as a test-out would", () => {
    const aced = getAcedSkillIds({
      items: [...lessons("fractions", 2), ...lessons("ratios", 1), ...lessons("guessed", 1)],
      result: { topics: [topic("fractions", 3, 3), topic("ratios", 3, 4), topic("guessed", 2, 2)] },
    });

    expect([...aced]).toStrictEqual(["fractions"]);
  });

  it("leaves a topic in the plan when it has more lessons than its answers vouch for", () => {
    const items = [...lessons("fractions", 7), ...lessons("ratios", 6)];

    const aced = getAcedSkillIds({
      items,
      result: { topics: [topic("fractions", 3, 3), topic("ratios", 3, 3)] },
    });

    expect([...aced]).toStrictEqual(["ratios"]);
    expect(findSkippableItems({ aced, items })).toHaveLength(6);
  });

  it("skips only lessons teaching nothing but known topics, and only ones still to do", () => {
    const aced = new Set(["fractions"]);

    const items = [
      { skillIds: ["fractions"], status: "todo" },
      { skillIds: ["fractions", "ratios"], status: "todo" },
      { skillIds: ["fractions"], status: "done" },
      { skillIds: [], status: "todo" },
    ];

    expect(findSkippableItems({ aced, items })).toStrictEqual([items[0]]);
  });
});

describe(findWeakestArea, () => {
  const planAreas = ["Math", "Languages", "Sciences"];

  it("offers more time to the area answered right least often, below 60%", () => {
    const weakest = findWeakestArea({
      focusAreas: [],
      planAreas,
      result: { areas: [area("Math", 2, 10), area("Languages", 5, 10), area("Sciences", 9, 10)] },
    });

    expect(weakest?.name).toBe("Math");
  });

  it("offers nothing for one subject's mock, an area already focused, or too few questions", () => {
    const offer = (areas: ReturnType<typeof area>[], focusAreas: string[] = []) =>
      findWeakestArea({ focusAreas, planAreas, result: { areas } });

    expect(offer([area("Math", 1, 10)])).toBeNull();
    expect(offer([area("Math", 1, 10), area("Languages", 9, 10)], ["Math"])).toBeNull();
    expect(offer([area("Math", 1, 4), area("Languages", 9, 10)])).toBeNull();
    expect(offer([area("Math", 7, 10), area("Languages", 9, 10)])).toBeNull();
  });
});

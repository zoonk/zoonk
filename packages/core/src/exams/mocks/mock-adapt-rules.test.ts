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

const P1 = "Conhecimentos básicos (P1)";
const P2 = "Conhecimentos complementares (P2)";
const P3 = "Conhecimentos específicos (P3)";

function scored({
  blank = 0,
  name,
  part,
  points = 1,
  right,
  wrong,
}: {
  blank?: number;
  name: string;
  part: string;
  points?: number;
  right: number;
  wrong: number;
}) {
  return {
    ...area(name, right, right + wrong + blank),
    part,
    points: { asked: (right + wrong + blank) * points, earned: (right - wrong) * points },
  };
}

function tested({
  earned,
  max,
  met = null,
  minimum,
  name,
  projected = null,
}: {
  earned: number;
  max: number;
  met?: boolean | null;
  minimum: number;
  name: string;
  projected?: number | null;
}) {
  return {
    asked: max,
    earned,
    max,
    met,
    minimum: { unit: "points" as const, value: minimum },
    name,
    projected,
    qualifying: false,
    short: met === false ? minimum - earned : null,
  };
}

function byTest(parts: ReturnType<typeof tested>[]) {
  return {
    asked: 0,
    earned: 0,
    max: null,
    met: null,
    minimum: null,
    parts,
    projected: null,
    short: null,
    unjudged: [],
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

  describe("on an exam scored in points, such as Cebraspe's where a wrong answer cancels a right one", () => {
    const subjects = [
      "Ciência Política",
      "Direito Público",
      "Governança e Riscos",
      "Transparência e Ouvidoria",
      "Auditoria",
    ];

    it("offers the subject that lost the most points in a test below its minimum, before a lower share elsewhere", () => {
      const weakest = findWeakestArea({
        focusAreas: [],
        planAreas: subjects,
        result: {
          areas: [
            scored({ name: "Ciência Política", part: P1, right: 7, wrong: 3 }),
            scored({ blank: 1, name: "Governança e Riscos", part: P2, right: 5, wrong: 2 }),
            scored({ name: "Direito Público", part: P2, right: 5, wrong: 3 }),
            scored({ blank: 40, name: "Auditoria", part: P3, points: 2, right: 50, wrong: 0 }),
          ],
          points: byTest([
            tested({ earned: 16, max: 40, met: true, minimum: 8, name: P1 }),
            tested({ earned: 10, max: 40, met: false, minimum: 12, name: P2 }),
            tested({ earned: 100, max: 180, met: true, minimum: 54, name: P3 }),
          ]),
        },
      });

      expect(weakest?.name).toBe("Direito Público");
    });

    it("counts a test projected below its minimum, in a mock that asked only part of it", () => {
      const weakest = findWeakestArea({
        focusAreas: [],
        planAreas: subjects,
        result: {
          areas: [
            scored({ name: "Direito Público", part: P2, right: 5, wrong: 3 }),
            scored({ blank: 10, name: "Auditoria", part: P3, points: 2, right: 10, wrong: 0 }),
          ],
          points: byTest([
            tested({ earned: 2, max: 40, minimum: 12, name: P2, projected: 10 }),
            tested({ earned: 20, max: 180, minimum: 54, name: P3, projected: 90 }),
          ]),
        },
      });

      expect(weakest?.name).toBe("Direito Público");
    });

    it("doesn't trust a projection from fewer than five of the test's questions", () => {
      const weakest = findWeakestArea({
        focusAreas: [],
        planAreas: subjects,
        result: {
          areas: [
            scored({ name: "Direito Público", part: P2, right: 1, wrong: 2 }),
            scored({ blank: 10, name: "Auditoria", part: P3, points: 2, right: 10, wrong: 0 }),
          ],
          points: byTest([
            tested({ earned: -1, max: 40, minimum: 12, name: P2, projected: -13.33 }),
            tested({ earned: 20, max: 180, minimum: 54, name: P3, projected: 90 }),
          ]),
        },
      });

      expect(weakest?.name).toBe("Auditoria");
    });

    it("sends no time elsewhere while every subject of a test below its minimum is already focused", () => {
      const weakest = findWeakestArea({
        focusAreas: ["Direito Público"],
        planAreas: subjects,
        result: {
          areas: [
            scored({ name: "Direito Público", part: P2, right: 5, wrong: 3 }),
            scored({ blank: 40, name: "Auditoria", part: P3, points: 2, right: 50, wrong: 0 }),
          ],
          points: byTest([
            tested({ earned: 2, max: 40, met: false, minimum: 12, name: P2 }),
            tested({ earned: 100, max: 180, met: true, minimum: 54, name: P3 }),
          ]),
        },
      });

      expect(weakest).toBeNull();
    });

    it("ranks by points earned when every test clears its minimum, so a wrong answer costs more than a blank", () => {
      const weakest = findWeakestArea({
        focusAreas: [],
        planAreas: subjects,
        result: {
          areas: [
            scored({ blank: 5, name: "Transparência e Ouvidoria", part: P2, right: 5, wrong: 0 }),
            scored({ name: "Governança e Riscos", part: P2, right: 6, wrong: 4 }),
            scored({ name: "Ciência Política", part: P1, right: 9, wrong: 1 }),
          ],
          points: byTest([
            tested({ earned: 8, max: 40, met: true, minimum: 8, name: P1 }),
            tested({ earned: 12, max: 40, met: true, minimum: 12, name: P2 }),
          ]),
        },
      });

      expect(weakest?.name).toBe("Governança e Riscos");
    });
  });
});

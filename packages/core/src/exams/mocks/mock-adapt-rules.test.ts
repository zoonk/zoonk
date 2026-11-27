import { describe, expect, it } from "vitest";
import { findSkippableItems, getAcedSkillIds, listShortParts } from "./mock-adapt-rules";

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

describe(listShortParts, () => {
  it("names a test that ended below its minimum, as Cebraspe's tests can", () => {
    const short = listShortParts({
      areas: [
        scored({ name: "Ciência Política", part: P1, right: 7, wrong: 3 }),
        scored({ name: "Direito Público", part: P2, right: 5, wrong: 3 }),
      ],
      points: byTest([
        tested({ earned: 16, max: 40, met: true, minimum: 8, name: P1 }),
        tested({ earned: 10, max: 40, met: false, minimum: 12, name: P2 }),
      ]),
    });

    expect(short).toStrictEqual(new Set([P2]));
  });

  it("counts a test projected below its minimum only from five of its questions or more", () => {
    const short = (right: number, wrong: number) =>
      listShortParts({
        areas: [scored({ name: "Direito Público", part: P2, right, wrong })],
        points: byTest([tested({ earned: 2, max: 40, minimum: 12, name: P2, projected: 10 })]),
      });

    expect(short(5, 3)).toStrictEqual(new Set([P2]));
    expect(short(1, 2)).toStrictEqual(new Set());
  });

  it("names nothing for a mock not scored in points", () => {
    expect(listShortParts({ areas: [area("Math", 1, 10)], points: null })).toStrictEqual(new Set());
  });
});

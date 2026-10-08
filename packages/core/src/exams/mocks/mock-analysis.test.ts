import { describe, expect, it } from "vitest";
import { type GradedMockAnswer, analyzeMock, getMockMeasure } from "./mock-analysis";
import { type MockConditions } from "./mock-contract";

const EASY = { difficulty: -1, discrimination: 1, guessing: 0.2 };
const HARD = { difficulty: 1, discrimination: 1, guessing: 0.2 };

function conditions(scoring: MockConditions["scoring"]): MockConditions {
  return {
    day: 2,
    fullLength: false,
    purpose: "planned",
    scoring,
    sections: [
      { itemIds: [], minutes: 20, name: "Natural Sciences and Math", questions: 6, routing: null },
    ],
    shape: null,
    startTime: "13:30",
    timeZone: "America/Sao_Paulo",
    timedOutSections: [],
  };
}

function answer(overrides: Partial<GradedMockAnswer>): GradedMockAnswer {
  return {
    area: "Math",
    durationMs: 120_000,
    flagged: false,
    irtItem: EASY,
    outcome: "right",
    section: 0,
    skill: { id: "fractions", name: "Fractions" },
    timedOut: false,
    ...overrides,
  };
}

const ANSWERS = [
  answer({ outcome: "wrong" }),
  answer({ durationMs: 360_000, outcome: "wrong" }),
  answer({ irtItem: HARD }),
  answer({ area: "Natural Sciences", durationMs: 300_000, irtItem: HARD }),
  answer({ area: "Natural Sciences", outcome: "blank", timedOut: true }),
  answer({ area: "Natural Sciences" }),
];

describe(analyzeMock, () => {
  it("says how each topic went, in the order the mock first asked it", () => {
    const ecology = { id: "ecology", name: "Ecology" };

    const result = analyzeMock({
      answers: [
        answer({ area: "Natural Sciences", skill: ecology }),
        answer({ outcome: "wrong" }),
        answer({ area: "Natural Sciences", skill: ecology }),
        answer({ outcome: "blank" }),
      ],
      conditions: conditions("raw"),
      minutesUsed: 10,
      preparation: null,
      previous: null,
    });

    expect(result.topics).toStrictEqual([
      { area: "Natural Sciences", correct: 2, name: "Ecology", skillId: "ecology", total: 2 },
      { area: "Math", correct: 0, name: "Fractions", skillId: "fractions", total: 2 },
    ]);
  });

  it("scores ENEM by area with IRT, time per question against the pace and coherence", () => {
    const result = analyzeMock({
      answers: ANSWERS,
      conditions: conditions("irt"),
      minutesUsed: 20,
      preparation: { after: 0.61, before: 0.58 },
      previous: 655,
    });

    expect(result).toMatchObject({
      blank: 1,
      calibration: null,
      coherence: { easyWrong: 3, hardRight: 2, isCoherent: false },
      correct: 3,
      net: null,
      plannedMinutes: 20,
      previous: 655,
      total: 6,
      unansweredAtTimeout: 1,
    });

    const math = result.areas.find((area) => area.name === "Math");

    expect(math).toMatchObject({
      correct: 1,
      secondsPerQuestion: 200,
      targetSecondsPerQuestion: 200,
    });

    expect(math?.score?.low).toBeLessThanOrEqual(math?.score?.score ?? 0);
    expect(result.irt?.score).toBeGreaterThan(0);
    expect(getMockMeasure(result)).toBe(result.irt?.score);
  });

  it("scores Cebraspe as a net score with calibration from flagged answers", () => {
    const result = analyzeMock({
      answers: [
        answer({}),
        answer({}),
        answer({ flagged: true, outcome: "wrong" }),
        answer({ outcome: "blank" }),
      ],
      conditions: conditions("net"),
      minutesUsed: 10,
      preparation: null,
      previous: null,
    });

    expect(result.net).toStrictEqual({ blank: 1, max: 4, net: 1, right: 2, wrong: 1 });
    expect(result.calibration?.unsure).toStrictEqual({ answered: 1, right: 0 });
    expect(result.irt).toBeNull();
    expect(getMockMeasure(result)).toBe(1);
  });

  it("counts right answers as a share otherwise", () => {
    const result = analyzeMock({
      answers: [answer({}), answer({ outcome: "wrong" })],
      conditions: conditions("raw"),
      minutesUsed: 5,
      preparation: null,
      previous: null,
    });

    expect(getMockMeasure(result)).toBe(50);
  });
});

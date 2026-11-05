import { describe, expect, it } from "vitest";
import {
  type SkillLevelState,
  applyLevelEvidence,
  getContentCeiling,
  getEarnedLanguageLevel,
  getFinishedBands,
  getLevelTrend,
  getOverallLevel,
  getStartScore,
  getStepLanguageSkill,
} from "./skill-level-rules";

const WINDOW_ANSWERS = 20;
const A2 = 1;
const B1 = 2;

function state(overrides: Partial<SkillLevelState> = {}): SkillLevelState {
  return {
    score: A2,
    startScore: A2,
    windowCeiling: null,
    windowCorrect: 0,
    windowTotal: 0,
    ...overrides,
  };
}

describe(applyLevelEvidence, () => {
  it("only counts answers until the window is full", () => {
    const next = applyLevelEvidence(state(), { ceiling: B1, correct: 3, total: 4 });

    expect(next).toMatchObject({ score: A2, windowCeiling: B1, windowCorrect: 3, windowTotal: 4 });
  });

  it("moves up half a step after a window of right answers at the level", () => {
    const next = applyLevelEvidence(state({ windowCorrect: 18, windowTotal: 19 }), {
      ceiling: B1,
      correct: 1,
      total: 1,
    });

    expect(next.score).toBe(1.5);
    expect(next.windowTotal).toBe(0);
    expect(next.startScore).toBe(A2);
  });

  it("never rises more than half a step above the content it answered", () => {
    const easy = state({ score: 1.5, windowCeiling: 1, windowCorrect: 19, windowTotal: 19 });
    const next = applyLevelEvidence(easy, { ceiling: 1, correct: 1, total: 1 });

    expect(next.score).toBe(1.5);
  });

  it("comes down half a step when most answers were wrong", () => {
    const next = applyLevelEvidence(state({ windowCorrect: 5, windowTotal: 19 }), {
      ceiling: A2,
      correct: 0,
      total: 1,
    });

    expect(next.score).toBe(0.5);
  });

  it("stays put for a mixed window", () => {
    const next = applyLevelEvidence(state({ windowCorrect: 13, windowTotal: 19 }), {
      ceiling: A2,
      correct: 1,
      total: 1,
    });

    expect(next.score).toBe(A2);
  });

  it("a conversation's answers count as one batch", () => {
    const next = applyLevelEvidence(state(), {
      ceiling: A2,
      correct: WINDOW_ANSWERS,
      total: WINDOW_ANSWERS,
    });

    expect(next.score).toBe(1.5);
  });
});

describe(getStartScore, () => {
  it("prefers the skill's own level from the test", () => {
    const details = { level: "A2", skillLevels: { reading: "B1" } };

    expect(getStartScore({ details, skill: "reading" })).toBe(B1);
    expect(getStartScore({ details, skill: "speaking" })).toBe(A2);
  });

  it("starts at A1 when nothing says the level", () => {
    expect(getStartScore({ details: {}, skill: "writing" })).toBe(0);
  });
});

describe(getStepLanguageSkill, () => {
  it("maps language screens to the skill they show", () => {
    expect(getStepLanguageSkill("listening")).toBe("listening");
    expect(getStepLanguageSkill("spokenAnswer")).toBe("speaking");
    expect(getStepLanguageSkill("typedAnswer")).toBe("writing");
    expect(getStepLanguageSkill("vocabulary")).toBe("reading");
    expect(getStepLanguageSkill("summary")).toBeNull();
  });
});

describe(getContentCeiling, () => {
  it("gives each Library band its highest level", () => {
    expect(getContentCeiling("beginner")).toBe(1.5);
    expect(getContentCeiling("advanced")).toBe(5);
  });
});

describe(getLevelTrend, () => {
  it("compares with where the learner started", () => {
    expect(getLevelTrend({ score: B1, startScore: A2 })).toBe("up");
    expect(getLevelTrend({ score: A2, startScore: B1 })).toBe("down");
    expect(getLevelTrend({ score: A2, startScore: A2 })).toBe("same");
  });
});

describe(getOverallLevel, () => {
  it("rounds the skills' average to the nearest half step", () => {
    expect(getOverallLevel([2, 2, 2, 1.5])).toBe("B1");
    expect(getOverallLevel([2, 2, 1.5, 1.5])).toBe("B1");
    expect(getOverallLevel([2, 1.5, 1.5])).toBe("A2+");
    expect(getOverallLevel([2, 2])).toBe("B1");
  });

  it("is null before any skill has a level", () => {
    expect(getOverallLevel([])).toBeNull();
  });
});

describe(getEarnedLanguageLevel, () => {
  const RAISED = new Date("2026-11-01T00:00:00Z");

  it("is the lowest skill the learner's answers raised", () => {
    expect(
      getEarnedLanguageLevel([
        { raisedAt: RAISED, score: 2.5 },
        { raisedAt: RAISED, score: 1.5 },
        { raisedAt: null, score: 0 },
      ]),
    ).toBe(1.5);
  });

  it("counts no skill a typed level or a test put there until answers raise it", () => {
    expect(getEarnedLanguageLevel([{ raisedAt: null, score: 5 }])).toBeNull();
    expect(getEarnedLanguageLevel([])).toBeNull();
  });

  it("keeps a raised skill that fell back, so the lowest can drop", () => {
    expect(
      getEarnedLanguageLevel([
        { raisedAt: RAISED, score: 3 },
        { raisedAt: RAISED, score: 0.5 },
      ]),
    ).toBe(0.5);
  });
});

describe(getFinishedBands, () => {
  it("finishes a band when the earned level reaches the next one", () => {
    expect(getFinishedBands({ after: 1, before: 0.5 })).toStrictEqual(["A1"]);
    expect(getFinishedBands({ after: 3, before: 2.5 })).toStrictEqual(["B1"]);
    expect(getFinishedBands({ after: 5, before: 4.5 })).toStrictEqual(["C1"]);
  });

  it("finishes nothing within a band, on a fall, or below where the climb started", () => {
    expect(getFinishedBands({ after: 2.5, before: 2 })).toStrictEqual([]);
    expect(getFinishedBands({ after: 0.5, before: 1 })).toStrictEqual([]);
    expect(getFinishedBands({ after: 2, before: 2 })).toStrictEqual([]);
  });

  it("finishes every band crossed at once", () => {
    expect(getFinishedBands({ after: 3, before: 0.5 })).toStrictEqual(["A1", "A2", "B1"]);
  });
});

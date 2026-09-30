import { describe, expect, it } from "vitest";
import {
  type SkillLevelState,
  applyLevelEvidence,
  getContentCeiling,
  getLevelTrend,
  getStartScore,
  getStepLanguageSkill,
} from "./skill-level-rules";

/** Answers a window holds before it moves a level. */
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

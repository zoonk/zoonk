import { describe, expect, it } from "vitest";
import { countSkillStates, getMasteryState, isFadingRetrievability } from "./mastery-state";

describe(getMasteryState, () => {
  it("is New until the first answer", () => {
    expect(getMasteryState({ recallDays: 0, reps: 0, stability: 0 })).toBe("new");
  });

  it("is Learning below a week of stability", () => {
    expect(getMasteryState({ recallDays: 1, reps: 3, stability: 6.9 })).toBe("learning");
  });

  it("is Solid from a week of stability", () => {
    expect(getMasteryState({ recallDays: 2, reps: 3, stability: 7 })).toBe("solid");
  });

  it("is Mastered once remembered on three different days", () => {
    expect(getMasteryState({ recallDays: 3, reps: 4, stability: 5 })).toBe("mastered");
  });
});

describe(isFadingRetrievability, () => {
  it("fades below the 90% retention FSRS schedules for", () => {
    expect(isFadingRetrievability(null)).toBe(false);
    expect(isFadingRetrievability(0.95)).toBe(false);
    expect(isFadingRetrievability(0.89)).toBe(true);
  });
});

describe(countSkillStates, () => {
  it("counts each state and the fading skills", () => {
    const counts = countSkillStates([
      { fading: false, state: "new" },
      { fading: true, state: "learning" },
      { fading: true, state: "mastered" },
      { fading: false, state: "mastered" },
    ]);

    expect(counts).toStrictEqual({
      fading: 2,
      learning: 1,
      mastered: 2,
      new: 1,
      solid: 0,
      total: 4,
    });
  });
});

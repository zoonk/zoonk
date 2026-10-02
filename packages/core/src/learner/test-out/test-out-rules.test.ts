import { describe, expect, it } from "vitest";
import { pickTestOutSkills, scoreTestOut } from "./test-out-rules";

describe(pickTestOutSkills, () => {
  it("keeps every skill of a small chapter", () => {
    expect(pickTestOutSkills(["a", "b", "c"])).toStrictEqual(["a", "b", "c"]);
  });

  it("spreads questions evenly over a big chapter", () => {
    const skills = Array.from({ length: 16 }, (_, index) => `s${index}`);

    expect(pickTestOutSkills(skills)).toStrictEqual([
      "s0",
      "s2",
      "s4",
      "s6",
      "s8",
      "s10",
      "s12",
      "s14",
    ]);
  });
});

describe(scoreTestOut, () => {
  const chapterSkillIds = ["a", "b", "c", "d", "e"];

  it("passes at 80% and counts the whole chapter known except missed skills", () => {
    const score = scoreTestOut({
      chapterSkillIds,
      results: [
        { isCorrect: true, skillId: "a" },
        { isCorrect: true, skillId: "b" },
        { isCorrect: true, skillId: "c" },
        { isCorrect: true, skillId: "d" },
        { isCorrect: false, skillId: "e" },
      ],
      testableSkillCount: 5,
    });

    expect(score).toStrictEqual({
      correct: 4,
      knownSkillIds: ["a", "b", "c", "d"],
      missedSkillIds: ["e"],
      passed: true,
      total: 5,
    });
  });

  it("only credits right answers when it fails", () => {
    const score = scoreTestOut({
      chapterSkillIds,
      results: [
        { isCorrect: true, skillId: "a" },
        { isCorrect: false, skillId: "b" },
        { isCorrect: false, skillId: "c" },
      ],
      testableSkillCount: 5,
    });

    expect(score.passed).toBe(false);
    expect(score.knownSkillIds).toStrictEqual(["a"]);
  });

  it("needs answers on three different skills", () => {
    const score = scoreTestOut({
      chapterSkillIds,
      results: [
        { isCorrect: true, skillId: "a" },
        { isCorrect: true, skillId: "a" },
      ],
      testableSkillCount: 5,
    });

    expect(score.passed).toBe(false);
  });

  it("accepts every testable skill in a chapter with fewer than three", () => {
    const score = scoreTestOut({
      chapterSkillIds: ["a", "b"],
      results: [
        { isCorrect: true, skillId: "a" },
        { isCorrect: true, skillId: "b" },
      ],
      testableSkillCount: 2,
    });

    expect(score.passed).toBe(true);
  });
});

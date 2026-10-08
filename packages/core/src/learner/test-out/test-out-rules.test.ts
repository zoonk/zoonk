import { describe, expect, it } from "vitest";
import { getTestOutQuestionCount, pickTestOutSkills, scoreTestOut } from "./test-out-rules";

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

describe(getTestOutQuestionCount, () => {
  it("asks more the more it can skip, never fewer than four questions nor more than eight", () => {
    expect([1, 4, 8, 9, 15, 40].map((lessons) => getTestOutQuestionCount(lessons))).toStrictEqual([
      4, 4, 4, 5, 8, 8,
    ]);
  });
});

describe(scoreTestOut, () => {
  const chapterSkillIds = ["a", "b", "c", "d", "e"];

  it("passes at 80% with every skill answered, and knows only the skills answered right", () => {
    const score = scoreTestOut({
      chapterSkillIds,
      results: [
        { isCorrect: true, skillId: "a" },
        { isCorrect: true, skillId: "b" },
        { isCorrect: true, skillId: "c" },
        { isCorrect: true, skillId: "d" },
        { isCorrect: false, skillId: "e" },
      ],
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
        { isCorrect: true, skillId: "d" },
        { isCorrect: true, skillId: "e" },
      ],
    });

    expect(score.passed).toBe(false);
    expect(score.knownSkillIds).toStrictEqual(["a", "d", "e"]);
  });

  it("can't pass on a skill or two of a bigger chapter, however many answers are right", () => {
    const oneSkill = scoreTestOut({
      chapterSkillIds,
      results: [{ isCorrect: true, skillId: "a" }],
    });

    const sameSkillTwice = scoreTestOut({
      chapterSkillIds,
      results: [
        { isCorrect: true, skillId: "a" },
        { isCorrect: true, skillId: "a" },
      ],
    });

    expect(oneSkill).toMatchObject({ knownSkillIds: ["a"], passed: false });
    expect(sameSkillTwice).toMatchObject({ knownSkillIds: ["a"], passed: false });
  });

  it("passes a big chapter on its sampled skills without counting the others as known", () => {
    const skills = Array.from({ length: 10 }, (_, index) => `s${index}`);
    const sampled = pickTestOutSkills(skills);

    const score = scoreTestOut({
      chapterSkillIds: skills,
      results: sampled.map((skillId) => ({ isCorrect: true, skillId })),
    });

    expect(score.passed).toBe(true);
    expect(score.knownSkillIds).toStrictEqual(sampled);
    expect(score.knownSkillIds).not.toContain("s4");
    expect(score.knownSkillIds).not.toContain("s9");
  });

  it("never skips a chapter on one right answer, even a chapter of one skill", () => {
    const one = scoreTestOut({
      chapterSkillIds: ["a"],
      results: [{ isCorrect: true, skillId: "a" }],
    });

    expect(one.passed).toBe(false);

    // Eight questions on its one skill: a slip still passes it, as 80% right overall does.
    const eight = scoreTestOut({
      chapterSkillIds: ["a"],
      results: Array.from({ length: 8 }, (_, index) => ({ isCorrect: index !== 3, skillId: "a" })),
    });

    expect(eight).toMatchObject({ knownSkillIds: ["a"], passed: true });
  });

  it("doesn't pass with no answers", () => {
    expect(scoreTestOut({ chapterSkillIds, results: [] })).toMatchObject({
      knownSkillIds: [],
      passed: false,
      total: 0,
    });
  });
});

import { describe, expect, it } from "vitest";
import { getExamPriority, getExamValue, inheritValues, orderSkills } from "./skill-order";

type Skill = { rank: number; skillId: string };

const byRank = (a: Skill, b: Skill) => a.rank - b.rank;

describe(orderSkills, () => {
  it("puts every prerequisite first and picks the best ready skill otherwise", () => {
    const skills: Skill[] = [
      { rank: 3, skillId: "a" },
      { rank: 1, skillId: "b" },
      { rank: 0, skillId: "c" },
      { rank: 2, skillId: "d" },
    ];

    const ordered = orderSkills({
      compare: byRank,
      prerequisites: new Map([["c", ["a"]]]),
      skills,
    });

    expect(ordered.map((skill) => skill.skillId)).toStrictEqual(["b", "d", "a", "c"]);
  });

  it("ignores prerequisites that aren't in the plan and survives a cycle", () => {
    const skills: Skill[] = [
      { rank: 0, skillId: "a" },
      { rank: 1, skillId: "b" },
    ];

    const ordered = orderSkills({
      compare: byRank,
      prerequisites: new Map([
        ["a", ["b", "known"]],
        ["b", ["a"]],
      ]),
      skills,
    });

    expect(ordered.map((skill) => skill.skillId)).toStrictEqual(["a", "b"]);
  });
});

describe(getExamValue, () => {
  it("rises with weight and the gap, and priority falls with the time a skill needs", () => {
    const base = getExamValue({ readiness: undefined, weight: 2 });

    expect(getExamValue({ readiness: undefined, weight: 4 })).toBe(base * 2);

    expect(getExamPriority({ minutes: 60, value: base })).toBe(
      getExamPriority({ minutes: 30, value: base }) / 2,
    );

    const mastered = getExamValue({
      readiness: { retrievabilityAtTarget: 0.9, stability: 40, state: "mastered" },
      weight: 2,
    });

    const fading = getExamValue({
      readiness: { retrievabilityAtTarget: 0.4, stability: 3, state: "learning" },
      weight: 2,
    });

    expect(mastered).toBeLessThan(fading);
    expect(fading).toBeLessThan(base);
  });

  it("puts a state the learner model is unsure about ahead of the same state with reviews behind it", () => {
    const readiness = { retrievabilityAtTarget: 0.5, stability: 8, state: "solid" as const };
    const guessed = getExamValue({ readiness: { ...readiness, reps: 1 }, weight: 2 });
    const reviewed = getExamValue({ readiness: { ...readiness, reps: 4 }, weight: 2 });

    expect(guessed).toBeGreaterThan(reviewed);
    expect(guessed).toBeLessThan(getExamValue({ readiness: undefined, weight: 2 }));
  });

  it("counts a gap placement found (a wrong first answer) as the whole gap, ahead of a skill answered right", () => {
    const untouched = getExamValue({ readiness: undefined, weight: 3 });

    const missed = getExamValue({
      readiness: { reps: 1, retrievabilityAtTarget: 0.45, stability: 0.2, state: "learning" },
      weight: 3,
    });

    const answered = getExamValue({
      readiness: { reps: 1, retrievabilityAtTarget: 0.64, stability: 2.3, state: "learning" },
      weight: 3,
    });

    expect(missed).toBe(untouched);
    expect(answered).toBeLessThan(missed);
  });
});

describe(inheritValues, () => {
  it("gives a prerequisite the value of the most valuable skill it opens, through chains", () => {
    const values = inheritValues({
      prerequisites: new Map([
        ["rewrite", ["cohesion"]],
        ["cohesion", ["classes"]],
        ["logic", ["classes"]],
        ["outside", ["classes"]],
      ]),
      values: new Map([
        ["classes", 1],
        ["cohesion", 2],
        ["rewrite", 5],
        ["logic", 3],
      ]),
    });

    expect(Object.fromEntries(values)).toStrictEqual({
      classes: 5,
      cohesion: 5,
      logic: 3,
      rewrite: 5,
    });
  });

  it("survives a cycle", () => {
    const values = inheritValues({
      prerequisites: new Map([
        ["a", ["b"]],
        ["b", ["a"]],
      ]),
      values: new Map([
        ["a", 1],
        ["b", 4],
      ]),
    });

    expect(Object.fromEntries(values)).toStrictEqual({ a: 4, b: 4 });
  });
});

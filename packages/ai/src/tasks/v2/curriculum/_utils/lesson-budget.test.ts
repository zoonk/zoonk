import { describe, expect, it } from "vitest";
import { fitLessonBudget } from "./lesson-budget";

describe(fitLessonBudget, () => {
  it("scales a graph past its test's budget down, keeping proportions and a lesson each", () => {
    const skills = [
      { estimatedLessons: 12, key: "membrane" },
      { estimatedLessons: 6, key: "organelles" },
      { estimatedLessons: 2, key: "viruses" },
    ];

    expect(
      fitLessonBudget({ budget: 8, skills }).map((skill) => skill.estimatedLessons),
    ).toStrictEqual([5, 2, 1]);
  });

  it("leaves a graph within its budget, or without one, as it is", () => {
    const skills = [{ estimatedLessons: 4 }, { estimatedLessons: 5 }];

    expect(fitLessonBudget({ budget: 8, skills })).toStrictEqual(skills);
    expect(fitLessonBudget({ budget: null, skills })).toStrictEqual(skills);
  });

  // Pedro's six headings came back as one skill of one lesson: every topic of the material gets a
  // lesson of its own, whatever the budget.
  it("gives a skill at least a lesson for each topic of the material it teaches", () => {
    const topics = ["S1.1", "S1.2", "S1.3", "S1.4", "S1.5", "S1.6"];

    const skills = [
      { estimatedLessons: 1, topics },
      { estimatedLessons: 9, topics: ["S1.7"] },
    ];

    expect(
      fitLessonBudget({ budget: 6, skills }).map((skill) => skill.estimatedLessons),
    ).toStrictEqual([6, 5]);

    expect(
      fitLessonBudget({ budget: 15, skills }).map((skill) => skill.estimatedLessons),
    ).toStrictEqual([6, 9]);
  });
});

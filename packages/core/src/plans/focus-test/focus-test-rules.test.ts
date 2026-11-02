import { describe, expect, it } from "vitest";
import {
  type FocusTestAnswer,
  chooseFocusAreas,
  getQuestionsPerArea,
  pickFocusTestAreas,
  scoreFocusTest,
  spreadAreaQuestions,
} from "./focus-test-rules";

function answersOn(area: string, results: boolean[], chance = 0.5): FocusTestAnswer[] {
  return results.map((isCorrect) => ({ area, chance, isCorrect }));
}

function areaResult(name: string, worth: number, mastery: number) {
  return { answers: [], correct: 0, label: name, mastery, name, total: 4, worth };
}

describe(pickFocusTestAreas, () => {
  it("asks about the ten areas worth most, in the plan's order", () => {
    const areas = Array.from({ length: 12 }, (_, index) => ({
      label: `Area ${index}`,
      name: `Area ${index}`,
      skillIds: [`skill-${index}`],
      worth: index === 2 ? 0 : (12 - index) / 12,
    }));

    expect(pickFocusTestAreas(areas).map((area) => area.name)).toStrictEqual([
      "Area 0",
      "Area 1",
      "Area 3",
      "Area 4",
      "Area 5",
      "Area 6",
      "Area 7",
      "Area 8",
      "Area 9",
      "Area 10",
    ]);
  });

  it("keeps the test short: four questions an area when there are few, three when many", () => {
    expect(getQuestionsPerArea(6)).toBe(4);
    expect(getQuestionsPerArea(8)).toBe(3);
  });
});

describe(spreadAreaQuestions, () => {
  it("spreads the questions over the area, repeating a skill only when there are too few", () => {
    expect(
      spreadAreaQuestions({ count: 4, skillIds: ["a", "b", "c", "d", "e", "f", "g", "h"] }),
    ).toStrictEqual(["a", "c", "e", "g"]);

    expect(spreadAreaQuestions({ count: 4, skillIds: ["a", "b"] })).toStrictEqual([
      "a",
      "a",
      "b",
      "b",
    ]);
  });
});

describe(scoreFocusTest, () => {
  it("takes lucky guesses out and never scores an area on one or two answers", () => {
    const results = scoreFocusTest({
      answers: [
        ...answersOn("Law", [true, true, false, false]),
        ...answersOn("Math", [true, true, true, true, false], 0.2),
        ...answersOn("History", [true, true]),
      ],
      areas: [
        { label: "Law", name: "Law", worth: 0.5 },
        { label: "Math", name: "Math", worth: 0.3 },
        { label: "History", name: "History", worth: 0.2 },
      ],
    });

    const rounded = results.map((result) => [
      result.name,
      result.correct,
      Math.round(result.mastery * 100) / 100,
    ]);

    expect(rounded).toStrictEqual([
      ["Law", 2, 0],
      ["Math", 4, 0.75],
    ]);
  });
});

describe(chooseFocusAreas, () => {
  it("focuses on the weakest areas worth most, at most a third of the areas tested", () => {
    expect(
      chooseFocusAreas([
        areaResult("Portuguese", 0.3, 0.9),
        areaResult("Law", 0.3, 0.2),
        areaResult("English", 0.05, 0),
        areaResult("IT", 0.15, 0.5),
        areaResult("Politics", 0.1, 0.1),
        areaResult("Linguistics", 0.1, 0.4),
      ]),
    ).toStrictEqual(["Law", "Politics"]);
  });

  it("gives the focus to the area worth most when every area is already known", () => {
    expect(
      chooseFocusAreas([areaResult("Law", 0.2, 1), areaResult("Portuguese", 0.4, 0.8)]),
    ).toStrictEqual(["Portuguese"]);
  });
});

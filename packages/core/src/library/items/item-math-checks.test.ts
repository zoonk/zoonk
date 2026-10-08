import { type GeneratedMathProblem } from "@zoonk/ai/tasks/v2/items/schemas";
import { describe, expect, it } from "vitest";
import { discountMath, discountQuestion as question } from "./_test-utils/math-problems";
import { checkMathProblem } from "./item-math-checks";

describe(checkMathProblem, () => {
  it("passes a problem whose answer, ranges, mistakes and steps check out", () => {
    expect(checkMathProblem({ math: discountMath, question })).toStrictEqual([]);
  });

  it("catches a stated answer that the solution doesn't give", () => {
    expect(checkMathProblem({ math: { ...discountMath, answer: 55 }, question })).toStrictEqual([
      "The stated answer 55 doesn't match the computed 60.",
    ]);
  });

  it("catches a solution that breaks for values a new version can draw", () => {
    const math: GeneratedMathProblem = {
      ...discountMath,
      answer: 1,
      commonMistakes: [
        { expression: "total", misconception: "Ignores the split", reason: "Split it." },
      ],
      solution: "total / (people - 4)",
      steps: [],
      variables: [
        { max: 100, min: 10, name: "total", step: 10, unit: null, value: 10 },
        { max: 10, min: 2, name: "people", step: 1, unit: null, value: 14 },
      ],
    };

    const problems = checkMathProblem({ math, question: "Split {total} among {people}." });

    expect(problems).toContain("Variable people is outside its range.");

    expect(
      problems.some((problem) => problem.startsWith("The solution fails for new numbers")),
    ).toBe(true);
  });

  it("requires every variable to appear in the question and every placeholder to be declared", () => {
    expect(
      checkMathProblem({
        math: discountMath,
        question: "A shirt costs {price} and {tax}. How much?",
      }),
    ).toStrictEqual(["The question never shows discount.", "The question shows undeclared {tax}."]);
  });

  it("accepts variables shown in the support text instead of the question", () => {
    expect(
      checkMathProblem({
        context: "A shirt costs {price} and is {discount}% off.",
        math: discountMath,
        question: "How much do you pay?",
      }),
    ).toStrictEqual([]);
  });

  it("rejects expressions with undeclared variables", () => {
    const math = { ...discountMath, solution: "price * (1 - rate / 100)" };

    expect(checkMathProblem({ math, question })).toStrictEqual([
      "The solution uses undeclared rate.",
    ]);
  });

  it("rejects a common mistake that gives the correct answer", () => {
    const math = {
      ...discountMath,
      commonMistakes: [
        {
          expression: "price - price * discount / 100",
          misconception: "Same thing",
          reason: "Same.",
        },
      ],
    };

    expect(checkMathProblem({ math, question })).toStrictEqual([
      "Common mistake 1 gives the correct answer.",
    ]);
  });

  it("rejects steps that type computed numbers, which new versions would make wrong", () => {
    const math = {
      ...discountMath,
      steps: [
        { expression: "price * discount / 100", text: "{discount}% of {price} is 20." },
        { expression: null, text: "Subtract it: you pay R$ 60,00." },
      ],
    };

    expect(checkMathProblem({ math, question })).toStrictEqual([
      "Step 1 types the computed 20 instead of a placeholder.",
      "Step 2 types the computed 60 instead of a placeholder.",
    ]);
  });

  it("allows numbers that are also variable values, and requires an expression for {result}", () => {
    const math = {
      ...discountMath,
      steps: [
        { expression: null, text: "Take 25 out of every 100 reais of {price}." },
        { expression: null, text: "You pay {result}." },
      ],
    };

    expect(checkMathProblem({ math, question })).toStrictEqual([
      "Step 2 shows {result} without an expression.",
    ]);
  });

  it("reserves the result placeholder name", () => {
    const math: GeneratedMathProblem = {
      ...discountMath,
      answer: 6,
      commonMistakes: [{ expression: "result + 1", misconception: "Adds", reason: "No." }],
      solution: "result * 2",
      steps: [],
      variables: [{ max: 9, min: 1, name: "result", step: 1, unit: null, value: 3 }],
    };

    expect(checkMathProblem({ math, question: "Double {result}." })).toStrictEqual([
      "A variable uses the reserved name result.",
    ]);
  });
});

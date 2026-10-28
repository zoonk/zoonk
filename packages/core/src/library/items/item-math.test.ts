import { type GeneratedMathProblem } from "@zoonk/ai/tasks/v2/items/schemas";
import { describe, expect, it } from "vitest";
import {
  discountMath,
  discountQuestion as question,
  thirdsMath,
} from "./_test-utils/math-problems";
import { checkMathAnswer, withNewNumbers } from "./item-math";

function sequence(...draws: number[]) {
  return () => draws.shift() ?? 0;
}

describe(withNewNumbers, () => {
  it("draws values on each variable's steps and fills the question and worked steps", () => {
    expect(
      withNewNumbers({ math: discountMath, question, random: sequence(0, 0.3) }),
    ).toStrictEqual({
      answer: 16,
      context: null,
      question: "A shirt costs 20 and is 20% off. How much do you pay?",
      steps: ["20% of 20 is 4.", "Subtract it: you pay 16."],
      values: { discount: 20, price: 20 },
    });
  });

  it("fills variables shown in the support text", () => {
    const result = withNewNumbers({
      context: "A shirt costs {price} and is {discount}% off.",
      math: discountMath,
      question: "How much do you pay?",
      random: sequence(0, 0.3),
    });

    expect(result.context).toBe("A shirt costs 20 and is 20% off.");
    expect(result.question).toBe("How much do you pay?");
  });

  it("skips draws where a common mistake gives the right answer", () => {
    const result = withNewNumbers({
      math: discountMath,
      question,
      random: sequence(0, 0.99, 0, 0),
    });

    expect(result.values).toStrictEqual({ discount: 10, price: 20 });
  });

  it("keeps drawn decimals free of floating-point noise", () => {
    const math: GeneratedMathProblem = {
      ...discountMath,
      answer: 0.3,
      commonMistakes: [{ expression: "rate * 2", misconception: "Doubles", reason: "No." }],
      solution: "rate * 3",
      steps: [],
      variables: [{ max: 0.3, min: 0.1, name: "rate", step: 0.1, unit: null, value: 0.1 }],
    };

    const result = withNewNumbers({ math, question: "Triple {rate}.", random: () => 0.99 });

    expect(result.values).toStrictEqual({ rate: 0.3 });
    expect(result.question).toBe("Triple 0.3.");
  });

  it("writes decimals the way the question's language does", () => {
    const math: GeneratedMathProblem = {
      ...discountMath,
      steps: [{ expression: "price * discount / 100", text: "Desconto: {result}." }],
      variables: [
        { max: 20.5, min: 20.5, name: "price", step: 1, unit: "R$", value: 20.5 },
        { max: 10, min: 10, name: "discount", step: 5, unit: "%", value: 10 },
      ],
    };

    const result = withNewNumbers({ language: "pt", math, question: "Custa {price}." });

    expect(result.question).toBe("Custa 20,5.");
    expect(result.steps).toStrictEqual(["Desconto: 2,05."]);
  });

  it("groups the digits of large numbers the way the question's language does", () => {
    const math: GeneratedMathProblem = {
      ...discountMath,
      answer: (12_500 / 40e6) * 100,
      commonMistakes: [{ expression: "owned / total", misconception: "No percent", reason: "No." }],
      solution: "owned / total * 100",
      steps: [{ expression: "total - owned", text: "{total} − {owned} = {result}" }],
      variables: [
        { max: 12_500, min: 12_500, name: "owned", step: 500, unit: null, value: 12_500 },
        { max: 40e6, min: 40e6, name: "total", step: 5e6, unit: null, value: 40e6 },
      ],
    };

    const shares = "Uma empresa tem {total} ações e você tem {owned}.";

    expect(withNewNumbers({ language: "pt", math, question: shares })).toMatchObject({
      question: "Uma empresa tem 40.000.000 ações e você tem 12.500.",
      steps: ["40.000.000 − 12.500 = 39.987.500"],
    });

    expect(withNewNumbers({ language: "en", math, question: shares }).question).toBe(
      "Uma empresa tem 40,000,000 ações e você tem 12,500.",
    );
  });

  it("leaves four-digit numbers such as years ungrouped", () => {
    const math: GeneratedMathProblem = {
      ...discountMath,
      answer: 2030,
      commonMistakes: [{ expression: "year", misconception: "Same year", reason: "No." }],
      solution: "year + 5",
      steps: [],
      variables: [{ max: 2025, min: 2025, name: "year", step: 1, unit: null, value: 2025 }],
    };

    expect(
      withNewNumbers({ language: "pt", math, question: "Em {year}, mais 5 anos?" }),
    ).toMatchObject({ question: "Em 2025, mais 5 anos?" });
  });

  it("keeps the checked numbers when no new draw works", () => {
    const math: GeneratedMathProblem = {
      ...discountMath,
      answer: 4,
      commonMistakes: [{ expression: "x * 2", misconception: "Doubles", reason: "No." }],
      solution: "x * x",
      steps: [],
      variables: [{ max: 2, min: 0, name: "x", step: 2, unit: null, value: 2 }],
    };

    expect(withNewNumbers({ math, question: "Square {x}." })).toStrictEqual({
      answer: 4,
      context: null,
      question: "Square 2.",
      steps: [],
      values: { x: 2 },
    });
  });
});

describe(checkMathAnswer, () => {
  const values = { discount: 25, price: 80 };

  it("accepts answers within the tolerance", () => {
    expect(checkMathAnswer({ answer: 60.004, math: discountMath, values })).toStrictEqual({
      isCorrect: true,
      mistake: null,
    });
  });

  it("names the common mistake a wrong answer matches", () => {
    expect(checkMathAnswer({ answer: 20, math: discountMath, values })).toStrictEqual({
      isCorrect: false,
      mistake: discountMath.commonMistakes[0],
    });
  });

  it("returns no mistake for an unexplained wrong answer", () => {
    expect(checkMathAnswer({ answer: 42, math: discountMath, values })).toStrictEqual({
      isCorrect: false,
      mistake: null,
    });
  });
});

describe("numeric entry rules", () => {
  const thirds = thirdsMath;
  const thirdsValues = { eaten: 1, slices: 3 };

  it("takes a fraction or a decimal written to the grid's precision", () => {
    const entry = { kind: "fraction", places: null } as const;

    const grade = (answer: number) =>
      checkMathAnswer({ answer, entry, math: thirds, values: thirdsValues }).isCorrect;

    expect([2 / 3, 0.6666, 0.6667, 0.666, 0.667].map((answer) => grade(answer))).toStrictEqual([
      true,
      true,
      true,
      true,
      true,
    ]);

    expect([0.67, 0.66, 0.7].map((answer) => grade(answer))).toStrictEqual([false, false, false]);
  });

  it("takes a number rounded or truncated to the places the question asks for", () => {
    const entry = { kind: "decimals", places: 2 } as const;
    const math = { ...thirds, answer: 2.3456, solution: "2.3456 + eaten - eaten" };

    const grade = (answer: number) =>
      checkMathAnswer({ answer, entry, math, values: thirdsValues }).isCorrect;

    expect([2.35, 2.34, 2.3456].map((answer) => grade(answer))).toStrictEqual([true, true, true]);
    expect([2.3, 2.33, 2.37].map((answer) => grade(answer))).toStrictEqual([false, false, false]);
  });

  it("takes any number rounded to the places the learner typed, when the question asks none", () => {
    const math = {
      ...thirds,
      answer: 11.88,
      solution: "11.88 + eaten - eaten",
      tolerance: { kind: "absolute", value: 0.005 },
    } as const;

    const grade = (answer: number) =>
      checkMathAnswer({ answer, math, values: thirdsValues }).isCorrect;

    expect([12, 11.9, 11.88].map((answer) => grade(answer))).toStrictEqual([true, true, true]);
    expect([11, 10, 11.8].map((answer) => grade(answer))).toStrictEqual([false, false, false]);
  });

  it("takes only the whole number for an integer answer", () => {
    const entry = { kind: "integer", places: null } as const;
    const values = { discount: 25, price: 80 };

    const grade = (answer: number) =>
      checkMathAnswer({ answer, entry, math: discountMath, values }).isCorrect;

    expect([60, 60.004, 59.999].map((answer) => grade(answer))).toStrictEqual([true, false, false]);
  });

  it("takes any of the other answers that are right too", () => {
    const roots: GeneratedMathProblem = {
      ...discountMath,
      answer: 2,
      commonMistakes: [{ expression: "a + b", misconception: "Adds the roots", reason: "No." }],
      solution: "a",
      steps: [],
      tolerance: { kind: "absolute", value: 0 },
      variables: [
        { max: 4, min: 1, name: "a", step: 1, unit: null, value: 2 },
        { max: 9, min: 5, name: "b", step: 1, unit: null, value: 5 },
      ],
    };

    const values = { a: 2, b: 5 };

    const grade = (answer: number) =>
      checkMathAnswer({ answer, math: roots, otherSolutions: ["b"], values });

    expect(grade(2).isCorrect).toBe(true);
    expect(grade(5).isCorrect).toBe(true);
    expect(grade(7)).toStrictEqual({ isCorrect: false, mistake: roots.commonMistakes[0] });
  });

  it("draws only numbers whose answer is a whole number for an integer answer", () => {
    const math: GeneratedMathProblem = {
      ...discountMath,
      answer: 2,
      commonMistakes: [{ expression: "price", misconception: "No percent", reason: "No." }],
      solution: "price * discount / 100",
      steps: [],
      tolerance: { kind: "absolute", value: 0 },
      variables: [
        { max: 25, min: 15, name: "price", step: 1, unit: null, value: 20 },
        { max: 10, min: 10, name: "discount", step: 1, unit: null, value: 10 },
      ],
    };

    const result = withNewNumbers({
      entry: { kind: "integer", places: null },
      math,
      question: "{discount}% of {price}?",
      random: sequence(0, 0, 0.1, 0, 0.5, 0),
    });

    expect(result).toMatchObject({ answer: 2, values: { discount: 10, price: 20 } });
  });
});

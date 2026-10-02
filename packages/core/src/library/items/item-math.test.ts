import { type GeneratedMathProblem } from "@zoonk/ai/tasks/v2/items/schemas";
import { describe, expect, it } from "vitest";
import { discountMath, discountQuestion as question } from "./_test-utils/math-problems";
import { checkMathAnswer, withNewNumbers } from "./item-math";

/** Returns the given draws in order, so each variable's value is chosen by the test. */
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
    // At 50% off, the discount equals the price paid, so the first draw is skipped.
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

  it("keeps the checked numbers when no new draw works", () => {
    // Doubling and squaring agree at 0 and at 2, so every draw would let the mistake pass.
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

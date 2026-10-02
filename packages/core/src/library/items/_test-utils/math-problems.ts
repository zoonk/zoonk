import { type GeneratedMathProblem } from "@zoonk/ai/tasks/v2/items/schemas";

export const discountQuestion =
  "A shirt costs {price} and is {discount}% off. How much do you pay?";

/** A checked math problem: 25% off 80 is 60, with two realistic mistakes. */
export const discountMath: GeneratedMathProblem = {
  answer: 60,
  commonMistakes: [
    {
      expression: "price * discount / 100",
      misconception: "Computes the discount instead of the price paid",
      reason: "That's how much you save, not what you pay.",
    },
    {
      expression: "price - discount",
      misconception: "Subtracts the percentage as money",
      reason: "25% of the price isn't 25 in money.",
    },
  ],
  solution: "price * (1 - discount / 100)",
  steps: [
    { expression: "price * discount / 100", text: "{discount}% of {price} is {result}." },
    { expression: "price * (1 - discount / 100)", text: "Subtract it: you pay {result}." },
  ],
  tolerance: { kind: "absolute", value: 0.005 },
  unit: "R$",
  variables: [
    { max: 200, min: 20, name: "price", step: 10, unit: "R$", value: 80 },
    { max: 50, min: 10, name: "discount", step: 5, unit: "%", value: 25 },
  ],
};

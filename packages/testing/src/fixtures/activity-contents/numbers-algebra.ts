/* oxlint-disable no-magic-numbers -- Fixture content is literal lesson data. */
import { choiceCheck, exampleData, interactionCheck, numericCheck } from "./activity-checks";

/** Numbers and algebra: one valid activity per template. */
export const numbersAlgebraActivities = {
  areaModel: {
    check: choiceCheck("What is the garden's area?", [
      ["212 m²", false, 212],
      ["322 m²", true, 322],
      ["37 m²", false, 37],
    ]),
    fields: {
      height: { parts: [10, 4], total: 14 },
      model: "area",
      unit: "m",
      width: { parts: [20, 3], total: 23 },
    },
    prompt: "A garden bed is 23 m by 14 m. Split it to find its area.",
    template: "areaModel",
  },
  balance: {
    check: numericCheck(3),
    fields: {
      equation: { left: "4*x + 1", right: "2*x + 7" },
      hints: [{ hint: "Take the same off both sides.", move: "Took bags off one side" }],
      objects: [
        { label: "One bag of rice", symbol: "x" },
        { label: "1 kg", symbol: "1" },
      ],
      steps: [
        { left: "2*x + 1", move: "Take 2 bags off each side", right: "7" },
        { left: "2*x", move: "Take 1 kg off each side", right: "6" },
        { left: "x", move: "Split into 2 equal groups", right: "3" },
      ],
      variable: "x",
    },
    prompt: "Every bag weighs the same. How heavy is one bag?",
    template: "balance",
  },
  estimateReveal: {
    check: { ...numericCheck(11.57), tolerance: { kind: "relative", value: 0.01 } },
    fields: {
      comparison: "Less than two weeks.",
      expression: "1000000 / 86400",
      max: 3650,
      min: 1,
      scale: "log",
      takeaway: "A billion seconds is about 32 years.",
      unit: "days",
      workings: [
        { expression: "1000000 / 60", label: "minutes" },
        { expression: "1000000 / 86400", label: "days" },
      ],
    },
    prompt: "How long is a million seconds?",
    template: "estimateReveal",
  },
  numberLine: {
    check: numericCheck(5),
    fields: {
      label: "Temperature",
      max: 7,
      min: -5,
      moves: [{ by: 3 }, { by: 5 }],
      start: -3,
      step: 1,
      unit: "°C",
    },
    prompt: "At 7 am it's −3 °C. By noon it's 8 degrees warmer.",
    template: "numberLine",
  },
  sliderGraph: {
    check: numericCheck(3869.68, { inputs: [{ name: "rate", value: 7 }] }),
    data: exampleData,
    fields: {
      compareAt: 5,
      formula: "1000 * (1 + rate / 100) ^ 20",
      output: { label: "Value after 20 years", unit: "$" },
      variable: {
        initial: 5,
        label: "Rate per year",
        max: 12,
        min: 0,
        name: "rate",
        step: 0.5,
        unit: "%",
      },
    },
    prompt: "Move the rate. What is $1,000 worth after 20 years?",
    template: "sliderGraph",
  },
  stepSolver: {
    check: interactionCheck,
    fields: {
      problem: "A $60 jacket is 25% off. With 8% sales tax, what do you pay?",
      steps: [
        {
          choices: [
            {
              id: "a",
              isCorrect: true,
              reason: "Tax is charged on the sale price.",
              text: "Take 25% off",
            },
            { id: "b", isCorrect: false, reason: "The discount comes first.", text: "Add the tax" },
          ],
          expression: "60 * (1 - 0.25)",
          id: "discount",
          math: "60 − 15 = 45",
          prompt: "What comes first?",
          value: 45,
        },
        {
          choices: [
            { id: "a", isCorrect: false, reason: "That's before the discount.", text: "$60" },
            { id: "b", isCorrect: true, reason: "You pay tax on what you pay.", text: "$45" },
          ],
          expression: "45 * 0.08",
          id: "tax",
          math: "8% of 45 = 3.60",
          prompt: "8% of which price?",
          value: 3.6,
        },
      ],
    },
    prompt: "Solve it one step at a time.",
    template: "stepSolver",
  },
};

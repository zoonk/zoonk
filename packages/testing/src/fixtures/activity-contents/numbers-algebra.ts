/* oxlint-disable no-magic-numbers -- Fixture content is literal lesson data. */
import { exampleData, explained, numericCheck, reasonedChoice } from "./activity-checks";

export const numbersAlgebraActivities = {
  areaModel: {
    check: reasonedChoice("What is the garden's area?", [
      {
        isCorrect: false,
        reason: "That adds only two of the four pieces, 200 and 12.",
        text: "212 m²",
        value: 212,
      },
      {
        isCorrect: true,
        reason: "The four pieces are 200, 80, 30 and 12. Together they make 322.",
        text: "322 m²",
        value: 322,
      },
      {
        isCorrect: false,
        reason: "That adds the two sides, 23 + 14. An area multiplies them.",
        text: "37 m²",
        value: 37,
      },
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
    check: numericCheck(3, {
      explanation:
        "Take 2 bags and 1 kg off each side and 2 bags balance 6 kg, so one bag weighs 3 kg.",
      question: "How heavy is one bag?",
      unit: "kg",
    }),
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
    prompt: "Every bag weighs the same. Take the same off both sides until one bag is alone.",
    template: "balance",
  },
  formulaModel: {
    check: numericCheck(3869.68, {
      explanation: "At 7% a year, $1,000 grows to $3,869.68 in 20 years.",
      inputs: [{ name: "rate", value: 7 }],
      question: "What is $1,000 worth after 20 years at 7% a year?",
      unit: "$",
    }),
    data: exampleData,
    fields: {
      compareAt: 5,
      outputs: [
        {
          formula: "1000 * (1 + rate / 100) ^ 20",
          id: "value",
          label: "Value after 20 years",
          unit: "$",
        },
      ],
      variables: [
        { initial: 5, label: "Rate per year", max: 12, min: 0, name: "rate", step: 0.5, unit: "%" },
      ],
    },
    prompt: "Move the rate and watch $1,000 grow over 20 years.",
    template: "formulaModel",
  },
  guessReveal: {
    check: {
      ...numericCheck(11.57, {
        explanation: "A day has 86,400 seconds, and 1,000,000 ÷ 86,400 is about 11.6.",
        question: "How many days is a million seconds?",
      }),
      tolerance: { kind: "relative", value: 0.01 },
    },
    fields: {
      comparison: "Less than two weeks.",
      max: 3650,
      min: 1,
      scale: "log",
      takeaway: "A billion seconds is about 32 years.",
      truth: {
        expression: "1000000 / 86400",
        kind: "computed",
        workings: [
          { expression: "1000000 / 60", label: "minutes" },
          { expression: "1000000 / 86400", label: "days" },
        ],
      },
      unit: "days",
    },
    prompt: "How long is a million seconds?",
    template: "guessReveal",
  },
  numberLine: {
    check: numericCheck(5, {
      explanation: "Start at −3 and go up 8: it takes 3 to reach zero, then 5 more.",
      question: "What is the temperature at noon?",
      unit: "°C",
    }),
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
  stepSolver: {
    check: explained(
      "The discount comes first: $60 less 25% is $45. The tax is 8% of $45, which is $3.60, so you pay $48.60.",
    ),
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
          math: "8% of 45 = 3.6",
          prompt: "8% of which price?",
          value: 3.6,
        },
      ],
    },
    prompt: "Solve it one step at a time.",
    template: "stepSolver",
  },
};

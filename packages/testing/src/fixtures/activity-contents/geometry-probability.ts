/* oxlint-disable no-magic-numbers -- Fixture content is literal lesson data. */
import { citedData, numericCheck, reasonedChoice } from "./activity-checks";

export const geometryProbabilityActivities = {
  chartReader: {
    check: {
      ...reasonedChoice("How much did CO₂ rise from 2010 to 2020?", [
        { isCorrect: false, reason: "That's the rise from 1960 to 1970.", text: "9 ppm", value: 9 },
        { isCorrect: true, reason: "It went from 390 to 414 ppm.", text: "24 ppm", value: 24 },
        {
          isCorrect: false,
          reason: "The line climbs 24 ppm in that decade, less than half of 50.",
          text: "50 ppm",
          value: 50,
        },
      ]),
      output: "late",
    },
    data: citedData,
    fields: {
      points: [
        { x: 1960, y: 317 },
        { x: 1970, y: 326 },
        { x: 2010, y: 390 },
        { x: 2020, y: 414 },
      ],
      spans: [
        { from: 1960, id: "early", label: "1960 to 1970", to: 1970 },
        { from: 2010, id: "late", label: "2010 to 2020", to: 2020 },
      ],
      statistic: "change",
      xLabel: "Year",
      yLabel: "CO₂ (ppm)",
    },
    prompt: "Measure the rise decade by decade.",
    template: "chartReader",
  },
  distributionExplorer: {
    check: numericCheck(95.45, {
      explanation:
        "Two standard deviations on each side of 100 is 70 to 130, and 95.45% of scores fall there.",
      question: "What percent of people score within 2 standard deviations of the average?",
      unit: "%",
    }),
    data: { source: { title: "Wechsler Adult Intelligence Scale norms" } },
    fields: {
      distribution: { kind: "normal", mean: 100, sd: 15 },
      handles: { from: 90, to: 110 },
      target: { from: 70, to: 130 },
      unit: "IQ points",
      valueLabel: "IQ score",
    },
    prompt: "Drag the handles to cover 2 standard deviations.",
    template: "distributionExplorer",
  },
  geometryBoard: {
    check: numericCheck(180, {
      explanation: "However you drag the corners, the three angles add up to 180°.",
      question: "What do the three angles add up to?",
      unit: "°",
    }),
    fields: {
      invariant: "The angles always add to 180°.",
      measure: "angleSum",
      points: [
        { id: "a", movable: true, x: 0, y: 0 },
        { id: "b", movable: false, x: 4, y: 0 },
        { id: "c", movable: true, x: 1, y: 3 },
      ],
    },
    prompt: "Drag a corner and watch the angles.",
    template: "geometryBoard",
  },
  randomSimulation: {
    check: reasonedChoice("How often do you get exactly 5 heads?", [
      {
        isCorrect: false,
        reason: "5 heads is the most likely count, but 4 and 6 come up almost as often.",
        text: "Almost always",
        value: 0.9,
      },
      {
        isCorrect: false,
        reason: "Half is the chance of heads on one flip, not of exactly 5 heads in 10.",
        text: "About half the time",
        value: 0.5,
      },
      {
        isCorrect: true,
        reason: "252 of the 1,024 ways 10 flips can land have exactly 5 heads.",
        text: "About 1 in 4",
        value: 0.25,
      },
      {
        isCorrect: false,
        reason: "It's the most likely single count, about 1 time in 4.",
        text: "Rarely",
        value: 0.05,
      },
    ]),
    fields: {
      hitLabel: "Exactly 5 heads",
      mode: "chance",
      model: {
        hit: { comparison: "exactly", value: 5 },
        kind: "binomial",
        probability: 0.5,
        trials: 10,
      },
      runs: 1000,
      trialLabel: "10 flips",
    },
    prompt: "Flip a coin 10 times.",
    template: "randomSimulation",
  },
  unitCircle: {
    check: {
      ...numericCheck(0.5, {
        explanation:
          "At 30° the seat is half the wheel's radius above the middle, so sin 30° = 0.5.",
        question: "What is sin at 30°?",
      }),
      inputs: [{ name: "angle", value: 30 }],
      output: "sin",
    },
    fields: {
      angleUnit: "degrees",
      frame: "A Ferris wheel seat.",
      show: ["sin", "cos"],
      startAngle: 0,
    },
    prompt: "Turn the wheel to 30°.",
    template: "unitCircle",
  },
};

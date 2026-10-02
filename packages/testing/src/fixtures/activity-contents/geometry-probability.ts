/* oxlint-disable no-magic-numbers -- Fixture content is literal lesson data. */
import { choiceCheck, citedData, exampleData, numericCheck } from "./activity-checks";

/** Geometry, probability and data: one valid activity per template. */
export const geometryProbabilityActivities = {
  chartReader: {
    check: {
      ...choiceCheck("How much did CO₂ rise from 2010 to 2020?", [
        ["9 ppm", false, 9],
        ["24 ppm", true, 24],
        ["50 ppm", false, 50],
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
    check: numericCheck(95.45, { unit: "%" }),
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
    check: numericCheck(180),
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
  predictSimulate: {
    check: choiceCheck("How often do you get exactly 5 heads?", [
      ["Almost always", false, 0.9],
      ["About half the time", false, 0.5],
      ["About 1 in 4", true, 0.25],
      ["Rarely", false, 0.05],
    ]),
    fields: {
      hitLabel: "Exactly 5 heads",
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
    template: "predictSimulate",
  },
  samplingSimulator: {
    check: choiceCheck("Asking 4 times the people makes the error…", [
      ["Half as big", true, 0.5],
      ["A quarter as big", false, 0.25],
      ["The same", false, 1],
    ]),
    data: exampleData,
    fields: {
      population: { kind: "proportion", proportion: 0.5 },
      populationLabel: "Example town",
      runs: 200,
      sampleSizes: [100, 400],
      sizeLabel: "People per poll",
    },
    prompt: "Run 200 polls of each size.",
    template: "samplingSimulator",
  },
  unitCircle: {
    check: { ...numericCheck(0.5), inputs: [{ name: "angle", value: 30 }], output: "sin" },
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

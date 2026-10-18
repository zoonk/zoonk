/* oxlint-disable no-magic-numbers -- Fixture content is literal lesson data. */
import { choiceCheck, exampleData, interactionCheck, numericCheck } from "./activity-checks";

/**
 * Other modes of the generic engines, next to each one's fixture in `activityContentFixtures`:
 * what each merged template used to cover (a calculator, a what-if scenario, a projectile, cited
 * data, polls, dice, break-even, ear training). Core's validator test proves each one publishes.
 */
export const engineModeFixtures = {
  combinationGrid: {
    dice: {
      check: { ...numericCheck(0.1667), output: "7" },
      fields: {
        columns: { label: "Second die", values: [1, 2, 3, 4, 5, 6] },
        rows: { label: "First die", values: [1, 2, 3, 4, 5, 6] },
        rule: "sum",
        title: "Two dice",
      },
      prompt: "Every way two dice can land. How often do they add up to 7?",
      template: "combinationGrid",
    },
    timesTable: {
      check: interactionCheck,
      fields: {
        columns: { label: "Times", values: [1, 2, 3] },
        rows: { label: "Number", values: [2, 3, 4] },
        rule: "product",
        title: "Times table",
      },
      prompt: "Fill in the times table.",
      template: "combinationGrid",
    },
  },
  formulaModel: {
    calculator: {
      check: numericCheck(251.54, { inputs: [{ name: "extra", value: 200 }] }),
      data: exampleData,
      fields: {
        outputs: [
          {
            formula: "-log(1 - 0.005 * 200000 / (1199 + extra)) / log(1.005)",
            id: "months",
            label: "Months to pay off",
          },
        ],
        variables: [
          {
            initial: 0,
            label: "Extra per month",
            max: 500,
            min: 0,
            name: "extra",
            step: 50,
            unit: "$",
          },
        ],
      },
      prompt: "Add an extra payment to the example mortgage.",
      template: "formulaModel",
    },
    scenario: {
      check: {
        ...numericCheck(1000),
        inputs: [
          { name: "price", value: 4 },
          { name: "rentUp", value: 1 },
        ],
      },
      data: exampleData,
      fields: {
        events: [{ label: "Rent goes up $500", name: "rentUp" }],
        outputs: [
          {
            formula: "(price - 1) * (2000 - 250 * price) - 1500 - 500 * rentUp",
            id: "profit",
            label: "Monthly profit",
            unit: "$",
          },
        ],
        title: "Coffee cart",
        variables: [
          {
            initial: 3,
            label: "Price per cup",
            max: 6,
            min: 2,
            name: "price",
            step: 0.5,
            unit: "$",
          },
        ],
      },
      prompt: "Turn on the rent increase.",
      template: "formulaModel",
    },
    simulation: {
      check: numericCheck(40.77, { inputs: [{ name: "angle", value: 45 }] }),
      data: exampleData,
      fields: {
        outputs: [
          {
            formula: "speed^2 * sin(rad(2 * angle)) / 9.81",
            id: "distance",
            label: "Lands at",
            unit: "m",
          },
          {
            formula: "(speed * sin(rad(angle)))^2 / (2 * 9.81)",
            id: "peak",
            label: "Peak height",
            unit: "m",
          },
        ],
        plot: { x: "angle", y: "distance" },
        title: "Projectile",
        variables: [
          {
            initial: 30,
            label: "Launch angle",
            max: 90,
            min: 0,
            name: "angle",
            step: 1,
            unit: "°",
          },
          { initial: 20, label: "Speed", max: 30, min: 5, name: "speed", step: 1, unit: "m/s" },
        ],
      },
      prompt: "Move the angle and watch where the ball lands.",
      template: "formulaModel",
    },
  },
  guessReveal: {
    cited: {
      check: { ...numericCheck(14), tolerance: { kind: "absolute", value: 2 } },
      data: { source: { title: "The True Size of Africa", year: 2010 } },
      fields: {
        max: 30,
        min: 1,
        scale: "linear",
        takeaway: "The map stretches land near the poles.",
        truth: { kind: "cited", value: 14 },
        unit: "times",
      },
      prompt: "How many Greenlands fit in Africa?",
      template: "guessReveal",
    },
  },
  keyboardFretboard: {
    byEar: {
      check: interactionCheck,
      fields: { byEar: true, instruments: ["piano"], target: { kind: "notes", notes: ["C", "G"] } },
      prompt: "Play the sound, then find its two notes on the keys.",
      template: "keyboardFretboard",
    },
    byEarChoice: {
      check: choiceCheck("What did you hear?", [
        ["A major chord", false],
        ["A minor chord", true],
      ]),
      fields: {
        byEar: true,
        instruments: ["piano", "guitar"],
        target: { kind: "chord", quality: "minor", root: "A" },
      },
      prompt: "Play the chord. Does it sound major or minor?",
      template: "keyboardFretboard",
    },
  },
  lineCrossing: {
    breakEven: {
      check: { ...numericCheck(250), output: "x" },
      data: exampleData,
      fields: {
        change: "The rent for the workshop goes up by $500 a month.",
        feedback: {
          wrongDirection: "Higher rent costs more at every quantity.",
          wrongLine: "The price of each lamp didn't change.",
        },
        lines: [
          { id: "cost", intercept: 2000, label: "Cost", slope: 5 },
          { id: "revenue", intercept: 0, label: "Revenue", slope: 15 },
        ],
        shift: { amount: 500, direction: "up", line: "cost" },
        xLabel: "Lamps sold",
        yLabel: "Dollars per month",
      },
      prompt: "Move a line to show the new rent. How many lamps break even now?",
      template: "lineCrossing",
    },
  },
  randomSimulation: {
    sampling: {
      check: choiceCheck("Asking 4 times the people makes the error…", [
        ["Half as big", true, 0.5],
        ["A quarter as big", false, 0.25],
        ["The same", false, 1],
      ]),
      data: exampleData,
      fields: {
        mode: "sampling",
        population: { kind: "proportion", proportion: 0.5 },
        populationLabel: "Example town",
        runs: 200,
        sampleSizes: [100, 400],
        sizeLabel: "People per poll",
      },
      prompt: "Run 200 polls of each size.",
      template: "randomSimulation",
    },
  },
};

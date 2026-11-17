/* oxlint-disable no-magic-numbers -- Fixture content is literal lesson data. */
import { exampleData, explained, numericCheck, reasonedChoice } from "./activity-checks";

export const engineModeFixtures = {
  combinationGrid: {
    dice: {
      check: {
        ...numericCheck(0.1667, {
          explanation: "6 of the 36 squares add up to 7, and 6 ÷ 36 is about 0.167.",
          question: "What is the chance of a 7, as a decimal?",
        }),
        output: "7",
      },
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
      check: explained("Each square is its row's number times its column's."),
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
      check: numericCheck(251.54, {
        explanation:
          "With $200 extra a month the loan is paid off in 251.54 months, about 9 years sooner than with no extra.",
        inputs: [{ name: "extra", value: 200 }],
        question: "How many months does it take with $200 extra a month?",
      }),
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
        ...numericCheck(1000, {
          explanation:
            "At $4 a cup the cart sells 1,000 cups and keeps $3 on each: $3,000. Take off $1,500 in costs and the $500 of extra rent and $1,000 is left.",
          question: "What is the monthly profit at $4 a cup with the higher rent?",
          unit: "$",
        }),
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
      check: numericCheck(40.77, {
        explanation:
          "At 45° and 20 m/s the ball lands 40.77 m away, farther than at any other angle.",
        inputs: [{ name: "angle", value: 45 }],
        question: "How far away does the ball land at 45° and 20 m/s?",
        unit: "m",
      }),
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
      check: {
        ...numericCheck(14, {
          explanation:
            "Africa covers about 30 million km² and Greenland about 2.2 million, so about 14 Greenlands fit.",
          question: "How many Greenlands fit in Africa?",
        }),
        tolerance: { kind: "absolute", value: 2 },
      },
      data: { source: { title: "The True Size of Africa", year: 2010 } },
      fields: {
        max: 30,
        min: 1,
        scale: "linear",
        takeaway:
          "The usual world map stretches land near the poles, so Greenland looks far bigger than it is.",
        truth: { kind: "cited", value: 14 },
        unit: "times",
      },
      prompt: "How many Greenlands fit in Africa?",
      template: "guessReveal",
    },
    money: {
      check: numericCheck(1200, { explanation: "Cost", question: "Your guess" }),
      fields: {
        max: 2000,
        min: 0,
        scale: "linear",
        takeaway: "Cost",
        truth: {
          expression: "1200",
          kind: "computed",
          workings: [{ expression: "1200", label: "Cost" }],
        },
        unit: "R$",
      },
      prompt: "Drag to guess",
      template: "guessReveal",
    },
  },
  keyboardFretboard: {
    byEar: {
      check: explained("The sound is C and G played together."),
      fields: { byEar: true, instruments: ["piano"], target: { kind: "notes", notes: ["C", "G"] } },
      prompt: "Play the sound, then find its two notes on the keys.",
      template: "keyboardFretboard",
    },
    byEarChoice: {
      check: reasonedChoice("What did you hear?", [
        {
          isCorrect: false,
          reason: "A major has C♯ where A minor has C, which sounds brighter.",
          text: "A major chord",
        },
        {
          isCorrect: true,
          reason:
            "A minor has C where A major has C♯, a half step lower. That gives the darker sound.",
          text: "A minor chord",
        },
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
      check: {
        ...numericCheck(250, {
          explanation:
            "The rent adds $500 to the cost at every quantity, so Cost moves up to start at $2,500. Each lamp brings in $10 more than it costs, so it takes 250 lamps to cover that.",
          question: "How many lamps does the workshop sell to break even now?",
        }),
        output: "x",
      },
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
      prompt: "Move a line to show the new rent.",
      template: "lineCrossing",
    },
  },
  randomSimulation: {
    sampling: {
      check: reasonedChoice("Asking 4 times the people makes the margin of error…", [
        {
          isCorrect: true,
          reason:
            "The margin shrinks with the square root of the sample: 4 times the people, half the margin.",
          text: "Half as big",
          value: 0.5,
        },
        {
          isCorrect: false,
          reason:
            "The margin shrinks more slowly than the sample grows: 4 times the people only halves it.",
          text: "A quarter as big",
          value: 0.25,
        },
        {
          isCorrect: false,
          reason: "A bigger sample lands closer to the town's true share, so the margin shrinks.",
          text: "The same",
          value: 1,
        },
      ]),
      data: exampleData,
      fields: {
        mode: "sampling",
        population: { kind: "proportion", proportion: 0.5 },
        populationLabel: "Example town",
        runs: 200,
        sampleSizes: [100, 400],
        sizeLabel: "People per sample",
      },
      prompt: "Poll the town 200 times with each sample size and see how far the results spread.",
      template: "randomSimulation",
    },
  },
};

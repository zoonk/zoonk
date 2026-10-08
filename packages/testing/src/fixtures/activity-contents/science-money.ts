/* oxlint-disable no-magic-numbers -- Fixture content is literal lesson data. */
import { choiceCheck, exampleData, interactionCheck, numericCheck } from "./activity-checks";

/** Science, money and business: one valid activity per template. */
export const scienceMoneyActivities = {
  labeledDiagram: {
    check: interactionCheck,
    fields: {
      diagramId: "human-heart",
      distractors: ["Pulmonary valve"],
      mixUps: [
        {
          feedback: "The drawing faces you, so the heart's right side is on your left.",
          labels: ["Right atrium", "Left atrium"],
        },
      ],
      parts: [
        { label: "Right atrium", partId: "right-atrium" },
        { label: "Left atrium", partId: "left-atrium" },
        { label: "Right ventricle", partId: "right-ventricle" },
        { label: "Left ventricle", partId: "left-ventricle" },
        { label: "Aorta", partId: "aorta" },
      ],
    },
    prompt: "Drag each name onto its part of the heart.",
    template: "labeledDiagram",
  },
  moleculeBuilder: {
    check: interactionCheck,
    fields: { elements: ["C", "O", "H"], formula: "CO2" },
    prompt: "Build CO₂ so every atom has all its bonds.",
    template: "moleculeBuilder",
  },
  parameterSimulation: {
    check: numericCheck(40.77, { inputs: [{ name: "angle", value: 45 }] }),
    fields: {
      model: "Projectile",
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
      variables: [
        { initial: 30, label: "Launch angle", max: 90, min: 0, name: "angle", step: 1, unit: "°" },
        { initial: 20, label: "Speed", max: 30, min: 5, name: "speed", step: 1, unit: "m/s" },
      ],
    },
    prompt: "Move the angle and watch where the ball lands.",
    template: "parameterSimulation",
  },
  processOrder: {
    check: interactionCheck,
    fields: {
      steps: [
        { icon: "sun", id: "absorb", text: "Chlorophyll absorbs sunlight" },
        {
          icon: "droplets",
          id: "split",
          text: "Water is split, releasing oxygen",
          why: "The absorbed light energy is what splits water.",
        },
        {
          icon: "battery-charging",
          id: "store",
          text: "Light energy is stored in ATP and NADPH",
          why: "Splitting water frees the electrons that charge ATP and NADPH.",
        },
        {
          icon: "refresh-cw",
          id: "calvin",
          text: "The Calvin cycle builds sugar from CO₂",
          why: "The Calvin cycle runs on the ATP and NADPH that light made.",
        },
        {
          icon: "wheat",
          id: "starch",
          text: "The plant stores sugar as starch",
          why: "There has to be sugar before any can be stored.",
        },
      ],
    },
    prompt: "How does a leaf turn light into sugar?",
    template: "processOrder",
  },
  punnettSquare: {
    check: choiceCheck("What share of the seeds grow white flowers?", [
      ["1 in 4", false, 0.25],
      ["1 in 2", true, 0.5],
      ["3 in 4", false, 0.75],
    ]),
    fields: {
      parents: [
        { alleles: ["P", "p"], label: "Purple parent" },
        { alleles: ["p", "p"], label: "White parent" },
      ],
      phenotypes: { dominant: "Purple", recessive: "White" },
      trait: "Flower color",
    },
    prompt: "Cross a purple Pp pea with a white pp pea.",
    template: "punnettSquare",
  },
  scenarioSimulator: {
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
      variables: [
        { initial: 3, label: "Price per cup", max: 6, min: 2, name: "price", step: 0.5, unit: "$" },
      ],
    },
    prompt: "Turn on the rent increase.",
    template: "scenarioSimulator",
  },
  sliderCalculator: {
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
    template: "sliderCalculator",
  },
  supplyDemand: {
    check: interactionCheck,
    data: { source: { publisher: "USDA", title: "Egg Markets Overview", year: 2022 } },
    fields: {
      demand: { intercept: 10, slope: -1 },
      event: "Bird flu cut the number of laying hens.",
      feedback: {
        wrongCurve: "People didn't want more eggs.",
        wrongDirection: "Fewer hens means less supply.",
      },
      priceLabel: "Price per dozen",
      quantityLabel: "Eggs sold",
      shift: { amount: 2, curve: "supply", direction: "left" },
      supply: { intercept: 1, slope: 0.5 },
    },
    prompt: "Drag a curve to explain the 2022 egg price spike.",
    template: "supplyDemand",
  },
};

/* oxlint-disable no-magic-numbers -- Fixture content is literal lesson data. */
import { explained, reasonedChoice } from "./activity-checks";

export const scienceMoneyActivities = {
  combinationGrid: {
    check: reasonedChoice("What share of the seeds grow white flowers?", [
      {
        isCorrect: false,
        reason: "That's the white share when both parents are Pp. Here one parent is pp.",
        text: "1 in 4",
        value: 0.25,
      },
      {
        isCorrect: true,
        reason: "Two of the four squares are pp, and only pp grows white.",
        text: "1 in 2",
        value: 0.5,
      },
      {
        isCorrect: false,
        reason: "That's the purple share when both parents are Pp.",
        text: "3 in 4",
        value: 0.75,
      },
    ]),
    fields: {
      columns: { label: "White parent", values: ["p", "p"] },
      rows: { label: "Purple parent", values: ["P", "p"] },
      rule: "alleles",
      title: "Flower color",
      traits: { dominant: "Purple", recessive: "White" },
    },
    prompt: "Cross a purple Pp pea with a white pp pea.",
    template: "combinationGrid",
  },
  labeledDiagram: {
    check: explained(
      "The atria sit on top and the ventricles under them, with the aorta arching over the heart. You face the heart, so its right side is on your left.",
    ),
    fields: {
      distractors: ["Pulmonary valve"],
      mixUps: [
        {
          feedback: "The picture faces you, so the heart's right side is on your left.",
          labels: ["Right atrium", "Left atrium"],
        },
      ],
      parts: [
        { label: "Right atrium", part: "right atrium" },
        { label: "Left atrium", part: "left atrium" },
        { label: "Right ventricle", part: "right ventricle" },
        { label: "Left ventricle", part: "left ventricle" },
        { label: "Aorta", part: "aorta" },
      ],
      picture: {
        alt: "A human heart cut open from the front, with five numbered spots",
        prompt: "A human heart cut open from the front, showing its four chambers and the aorta",
      },
    },
    prompt: "Put each name on its spot in the heart.",
    template: "labeledDiagram",
  },
  lineCrossing: {
    check: explained(
      "Fewer hens lay fewer eggs at every price, so Supply moves left. Along Demand, the price goes up and fewer eggs are sold.",
    ),
    data: { source: { publisher: "USDA", title: "Egg Markets Overview", year: 2022 } },
    fields: {
      change: "Bird flu cut the number of laying hens.",
      feedback: {
        wrongDirection: "Fewer hens means less supply.",
        wrongLine: "People didn't want more eggs.",
      },
      lines: [
        { id: "supply", intercept: 1, label: "Supply", slope: 0.5 },
        { id: "demand", intercept: 10, label: "Demand", slope: -1 },
      ],
      shift: { amount: 2, direction: "left", line: "supply" },
      xLabel: "Eggs sold",
      yLabel: "Price per dozen",
    },
    prompt: "Drag a line to explain the 2022 egg price spike.",
    template: "lineCrossing",
  },
  moleculeBuilder: {
    check: explained(
      "Carbon makes four bonds and oxygen two, so each oxygen joins the carbon with a double bond: O=C=O.",
    ),
    fields: { elements: ["C", "O", "H"], formula: "CO2" },
    prompt: "Build CO₂ so every atom has all its bonds.",
    template: "moleculeBuilder",
  },
  processOrder: {
    check: explained(
      "Light comes first. It splits water and charges ATP and NADPH, which power the Calvin cycle that builds the sugar a plant stores.",
    ),
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
};

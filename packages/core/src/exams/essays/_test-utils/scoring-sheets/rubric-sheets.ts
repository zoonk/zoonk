import { type WritingSheet } from "../../../../library/exams/written-grading";
import { from } from "./cite";

const ap = from("ap-history-rubrics");

export const AP_GRADING: WritingSheet = {
  combination: ap("The essay's score is the sum of the points earned in the four rows.", {
    method: "sum" as const,
    step: null,
  }),
  conventions: [
    ap(
      "Each point is earned independently: an essay can earn a point for evidence without earning the thesis point.",
    ),
    ap(
      "An essay may contain errors that do not detract from its overall quality, as long as the historical content used to advance the argument is accurate.",
    ),
    ap(
      "Grammatical errors are not counted against a student unless they obscure the demonstration of the content knowledge and skills.",
    ),
  ],
  criteria: [
    ap("Thesis or claim", {
      awards: [
        ap("No thesis, or one that only restates or rephrases the prompt.", { points: 0 }),
        ap(
          "Responds to the prompt with a historically defensible thesis or claim that establishes a line of reasoning, in one place in the introduction or the conclusion.",
          { points: 1 },
        ),
      ],
      id: "thesis",
      points: 1,
    }),
    ap("Contextualization", {
      awards: [
        ap("No broader context, or only a phrase or a passing reference.", { points: 0 }),
        ap("Describes a broader historical context relevant to the prompt.", { points: 1 }),
      ],
      id: "context",
      points: 1,
    }),
    ap("Evidence", {
      awards: [
        ap("Fewer than two specific examples of evidence relevant to the topic.", { points: 0 }),
        ap(
          "Provides at least two specific examples of evidence relevant to the topic of the prompt.",
          { count: 2, points: 1 },
        ),
        ap(
          "Supports an argument in response to the prompt using at least two specific and relevant examples of evidence.",
          { count: 2, points: 2 },
        ),
      ],
      id: "evidence",
      points: 2,
    }),
    ap("Analysis and reasoning", {
      awards: [
        ap("No historical reasoning frames or structures the argument.", { points: 0 }),
        ap(
          "Uses historical reasoning (comparison, causation, continuity and change) to frame or structure an argument that addresses the prompt.",
          { points: 1 },
        ),
        ap(
          "Demonstrates a complex understanding of the historical development the prompt focuses on, through sophisticated argumentation or effective use of evidence.",
          { points: 2 },
        ),
      ],
      id: "analysis",
      points: 2,
    }),
  ],
  language: null,
  rounding: null,
  zeroing: [],
};

const aqa = from("aqa-history-mark-scheme");

export const HOLISTIC_GRADING: WritingSheet = {
  criteria: [
    aqa("The essay as a whole, placed in the level that fits it best", {
      awards: [
        aqa("Nothing worthy of credit.", { points: 0 }),
        aqa(
          "Level 1: addresses the question in broad terms or shows limited understanding; little organisation; information is irrelevant or inaccurate, with vague or generalist comment.",
          { points: 1, pointsHigh: 5 },
        ),
        aqa(
          "Level 2: descriptive, with some awareness of the question; limited organisation; some appropriate information of limited scope; unsupported generalisations.",
          { points: 6, pointsHigh: 10 },
        ),
        aqa(
          "Level 3: understands the question; a range of largely accurate information shows awareness of key issues; some organisation; comments link to the question but stay general or lack depth.",
          { points: 11, pointsHigh: 15 },
        ),
        aqa(
          "Level 4: good understanding of the question's demands; well organised; clear and specific supporting information; analytical, with a balanced argument and some judgement, which may be only partly substantiated.",
          { points: 16, pointsHigh: 20 },
        ),
        aqa(
          "Level 5: very good understanding of the question's full demands; well organised and effectively delivered; well-selected, specific and precise supporting information; fully analytical, with a balanced argument and a well-substantiated judgement.",
          { points: 21, pointsHigh: 25 },
        ),
      ],
      id: "essay",
      points: 25,
    }),
  ],
  language: null,
  rounding: null,
  zeroing: [],
};

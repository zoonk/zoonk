import { type ExamStructure } from "../../../library/exams/blueprint-contract";

const CITATION = { passage: "Synthetic notice fixture", sourceId: "notice" };

export const CGU_WRITTEN_GRADING = {
  criteria: [{ citation: CITATION, id: "case", points: 1, text: "Apply the notice's rule." }],
  language: null,
  rounding: null,
  zeroing: [],
} as const satisfies NonNullable<
  NonNullable<NonNullable<ExamStructure["mock"]>["sections"][number]["tasks"]>[number]["grading"]
>;

export const CGU: ExamStructure = {
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: {
      description: "Two tests, each worth half of the final score.",
      finalShares: [
        { citation: CITATION, parts: ["Objective test"], share: 0.5 },
        { citation: CITATION, parts: ["Written test"], share: 0.5 },
      ],
      method: "wrongCancelsRight",
      parts: [
        {
          citation: CITATION,
          maxPoints: 100,
          minimum: null,
          name: "Objective test",
          qualifying: false,
          questions: 170,
        },
        {
          citation: CITATION,
          maxPoints: 100,
          minimum: { unit: "points", value: 50 },
          name: "Written test",
          qualifying: false,
          questions: null,
        },
      ],
    },
    sections: [
      {
        day: null,
        kind: "objective",
        minutes: 300,
        name: "Objective test",
        questions: 170,
        session: "Morning",
      },
      {
        day: null,
        kind: "written",
        minutes: 210,
        name: "Written test",
        questions: null,
        session: "Afternoon",
        tasks: [
          {
            count: 1,
            description: "Short question",
            grading: CGU_WRITTEN_GRADING,
            key: "short",
            lines: 30,
            points: 30,
          },
          {
            count: 1,
            description: "Long question",
            grading: CGU_WRITTEN_GRADING,
            key: "long",
            lines: 60,
            points: 70,
          },
        ],
      },
    ],
    timeLimitMinutes: 510,
    totalQuestions: 170,
  },
  rules: [],
  subjects: [
    {
      citation: CITATION,
      group: "Objective test",
      name: "Control",
      questions: 170,
      topics: [],
      weight: null,
    },
    {
      citation: CITATION,
      group: "Written test",
      name: "Writing",
      questions: null,
      topics: [],
      weight: null,
    },
  ],
};

/** A CGU-like exam: an objective test in the morning, two written questions in the afternoon. */
const SHORT_LINES = 30;
const LONG_LINES = 60;
const SHORT_POINTS = 30;
const LONG_POINTS = 70;

const CITATION = { passage: "Item 12.2 of the notice", sourceId: "notice" };

export const CRITERIA = [
  { id: "a1", points: 9.5, text: "Difference between internal and external control" },
  { id: "a2", points: 9.5, text: "Powers of the Federal Court of Accounts" },
  { id: "a3", points: 9.5, text: "Purpose of the internal control system" },
  { id: "presentation", points: 1.5, text: "Presentation and structure" },
];

export const GRADING = {
  criteria: CRITERIA.map((criterion) => ({ ...criterion, citation: CITATION })),
  kind: "points" as const,
  language: null,
  rounding: null,
  zeroing: [],
};

export function task(key: "long" | "short") {
  const lines = key === "short" ? SHORT_LINES : LONG_LINES;
  const points = key === "short" ? SHORT_POINTS : LONG_POINTS;
  const description = `The ${lines}-line question`;

  return { count: 1, description, grading: GRADING, key, lines, points };
}

export const STRUCTURE = {
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
        tasks: [task("short"), task("long")],
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
      name: "Public administration",
      questions: 170,
      topics: [],
      weight: null,
    },
    {
      citation: CITATION,
      group: "Written test",
      name: "Written test",
      questions: null,
      topics: [],
      weight: null,
    },
  ],
};

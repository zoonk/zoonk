import { type ExampleSet } from "../example-set";

export const en: ExampleSet = {
  career: {
    goal: "become a data analyst in 6 months",
    name: "Data analyst in 6 months",
    skipped: "SQL basics",
    topics: [
      { lessons: 6, title: "Joins in SQL" },
      { lessons: 8, title: "Aggregations and GROUP BY" },
      { lessons: 20, title: "Python for data analysis" },
      { lessons: 10, title: "Dashboards in Tableau" },
      { lessons: 6, title: "Portfolio and technical interviews" },
    ],
  },
  exam: {
    day: [
      {
        detail: "Review of what comes up most",
        kind: "review",
        minutes: 6,
        title: "Linear equations",
      },
      {
        detail: "Reading and Writing",
        kind: "practice",
        minutes: 7,
        title: "Words in context questions",
      },
      { detail: "Review of what comes up most", kind: "review", minutes: 4, title: "Percentages" },
      { detail: "Reading and Writing", kind: "lesson", minutes: 8, title: "Transitions" },
    ],
    goal: (month) => `get ready for the SAT in ${month}`,
    headline: "Prep for the SAT",
    mock: {
      details: "98 questions · 2 h 14 min",
      firm: ["Linear equations", "Words in context", "Percentages"],
      mistakes: 9,
      name: "SAT",
      review: ["Quadratics", "Transitions"],
      scores: [
        { label: "Reading and Writing", range: "580–630" },
        { label: "Math", range: "600–650" },
      ],
    },
    name: "SAT",
    sittings: [
      "2026-11-07",
      "2026-12-05",
      "2027-03-06",
      "2027-05-01",
      "2027-06-05",
      "2027-08-28",
      "2027-09-18",
      "2027-10-09",
      "2027-11-06",
      "2027-12-04",
      "2028-03-04",
      "2028-05-06",
      "2028-06-03",
    ],
    timeZone: "America/New_York",
  },
  exams: "The SAT, the ACT, AP exams or the bar",
  move: "mexico-city",
  topic: {
    chapters: [
      "Why classical physics wasn’t enough",
      "Is light a wave or a particle?",
      "The Bohr model of the atom",
      "The uncertainty principle",
      "Entanglement",
    ],
    laterChapters: 7,
    name: "Quantum physics from scratch",
    subjects: "Quantum physics, art history, how the stock market works",
  },
};

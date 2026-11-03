import { type ExampleSet } from "../example-set";

export const de: ExampleSet = {
  career: {
    goal: "in 6 Monaten Data Analyst werden",
    name: "Data Analyst in 6 Monaten",
    skipped: "SQL-Grundlagen",
    topics: [
      { lessons: 6, title: "JOINs in SQL" },
      { lessons: 8, title: "Aggregationen und GROUP BY" },
      { lessons: 20, title: "Python für die Datenanalyse" },
      { lessons: 10, title: "Dashboards in Power BI" },
      { lessons: 6, title: "Portfolio und Fachinterviews" },
    ],
  },
  exam: {
    day: [
      { detail: "Wiederholung", kind: "review", minutes: 6, title: "Ableitungen" },
      { detail: "Mathematik", kind: "practice", minutes: 7, title: "Aufgaben zur Stochastik" },
      { detail: "Deutsch", kind: "lesson", minutes: 8, title: "Gedichtanalyse" },
      { detail: "Wiederholung", kind: "review", minutes: 4, title: "Kalter Krieg" },
    ],
    goal: (month) => `fürs Abitur im ${month} lernen`,
    headline: "Das Abitur schaffen",
    mock: {
      firm: ["Vektoren", "Wahrscheinlichkeit"],
      mistakes: 3,
      name: "Mathematik",
      review: ["Ableitungen", "Integrale"],
      scores: [{ label: "Mathematik", range: "10–12 Punkte" }],
    },
    name: "Abitur",
    sittings: ["2027-04-13"],
    timeZone: "Europe/Berlin",
  },
  exams: "Abitur, IHK-Prüfung, Staatsexamen oder Einbürgerungstest",
  move: "london",
  topic: {
    chapters: [
      "Warum die klassische Physik nicht mehr reichte",
      "Ist Licht Welle oder Teilchen?",
      "Das bohrsche Atommodell",
      "Die Unschärferelation",
      "Verschränkung",
    ],
    laterChapters: 7,
    name: "Quantenphysik von Grund auf",
    subjects: "Quantenphysik, Kunstgeschichte, wie die Börse funktioniert",
  },
};

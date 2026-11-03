import { type ExampleSet } from "../example-set";

export const it: ExampleSet = {
  career: {
    goal: "diventare data analyst in 6 mesi",
    name: "Data analyst in 6 mesi",
    skipped: "Basi di SQL",
    topics: [
      { lessons: 6, title: "JOIN in SQL" },
      { lessons: 8, title: "Aggregazioni e GROUP BY" },
      { lessons: 20, title: "Python per l’analisi dei dati" },
      { lessons: 10, title: "Dashboard con Power BI" },
      { lessons: 6, title: "Portfolio e colloqui tecnici" },
    ],
  },
  exam: {
    day: [
      { detail: "Ripasso", kind: "review", minutes: 6, title: "Derivate" },
      { detail: "Matematica", kind: "practice", minutes: 7, title: "Esercizi sui limiti" },
      { detail: "Italiano", kind: "lesson", minutes: 8, title: "Analisi del testo" },
      { detail: "Ripasso", kind: "review", minutes: 4, title: "Prima guerra mondiale" },
    ],
    goal: (month) => `prepararmi alla maturità di ${month}`,
    headline: "Passare la maturità",
    mock: {
      details: "6 h",
      firm: ["Integrali", "Probabilità"],
      mistakes: 3,
      name: "Seconda prova",
      review: ["Derivate", "Limiti"],
      scores: [{ label: "Seconda prova", range: "14–16/20" }],
    },
    name: "Maturità",
    sittings: ["2027-06-16"],
    timeZone: "Europe/Rome",
  },
  exams: "La maturità, il test di medicina, un concorso pubblico o l’esame della patente",
  move: "london",
  topic: {
    chapters: [
      "Perché la fisica classica non bastava",
      "La luce è un’onda o una particella?",
      "L’atomo di Bohr",
      "Il principio di indeterminazione",
      "L’entanglement",
    ],
    laterChapters: 7,
    name: "Fisica quantistica da zero",
    subjects: "La fisica quantistica, la storia dell’arte, come funziona la Borsa",
  },
};

import { type ExampleSet } from "../example-set";

export const fr: ExampleSet = {
  career: {
    goal: "devenir data analyst en 6 mois",
    name: "Data analyst en 6 mois",
    skipped: "Les bases de SQL",
    topics: [
      { lessons: 6, title: "Les jointures en SQL" },
      { lessons: 8, title: "Agrégations et GROUP BY" },
      { lessons: 20, title: "Python pour l’analyse de données" },
      { lessons: 10, title: "Tableaux de bord Power BI" },
      { lessons: 6, title: "Portfolio et entretiens techniques" },
    ],
  },
  exam: {
    day: [
      { detail: "Révision", kind: "review", minutes: 6, title: "Dérivation" },
      { detail: "Mathématiques", kind: "practice", minutes: 7, title: "Exercices de probabilités" },
      { detail: "Philosophie", kind: "lesson", minutes: 8, title: "La conscience" },
      { detail: "Révision", kind: "review", minutes: 4, title: "Mécanique de Newton" },
    ],
    goal: (month) => `me préparer au bac en ${month}`,
    headline: "Réussir le bac",
    mock: {
      details: "4 h",
      firm: ["Probabilités", "Fonction exponentielle"],
      mistakes: 3,
      name: "Mathématiques",
      review: ["Dérivation", "Suites"],
      scores: [{ label: "Mathématiques", range: "13–15/20" }],
    },
    name: "Bac",
    sittings: ["2027-06-14"],
    timeZone: "Europe/Paris",
  },
  exams: "Le bac, le brevet, un concours ou le code de la route",
  move: "london",
  topic: {
    chapters: [
      "Pourquoi la physique classique ne suffisait plus",
      "La lumière : onde ou particule ?",
      "L’atome de Bohr",
      "Le principe d’incertitude",
      "L’intrication quantique",
    ],
    laterChapters: 7,
    name: "La physique quantique en partant de zéro",
    subjects: "La physique quantique, l’histoire de l’art, le fonctionnement de la Bourse",
  },
};

import { type ExampleSet } from "../example-set";

const philosophy = { id: "philosophy", name: "Philosophie", share: 0.34 };
const maths = { id: "maths", name: "Mathématiques", share: 0.41 };
const physics = { id: "physics", name: "Physique-chimie", share: 0.29 };
const oral = { id: "oral", name: "Grand oral", share: 0.22 };

const conscience = {
  id: "conscience",
  minutes: 4,
  subject: philosophy,
  title: "La conscience et l’inconscient",
};

export const fr: ExampleSet = {
  exam: {
    goal: (month) => `me préparer au bac en ${month}`,
    mock: {
      score: "13–15/20",
      scoreOf: "Mathématiques",
      topics: [
        { id: "derivatives", name: "Dérivation", right: 2, total: 4 },
        { id: "sequences", name: "Suites", right: 3, total: 4 },
        { id: "probability", name: "Probabilités", right: 3, total: 3 },
        { id: "exponential", name: "Fonction exponentielle", right: 3, total: 3 },
      ],
    },
    name: "Bac",
    placed: {
      rows: [
        { id: "percentages", state: "skipped", title: "Pourcentages" },
        { id: "changes", state: "skipped", title: "Évolutions successives" },
        { id: "sequences", lessons: 6, state: "next", title: "Suites" },
        { id: "derivatives", lessons: 8, state: "todo", title: "Dérivation" },
        { id: "exponential", lessons: 7, state: "todo", title: "Fonction exponentielle" },
      ],
      subject: maths,
    },
    planName: (month) => `Bac en ${month}`,
    practice: {
      answer:
        "5, c’est la valeur de f en 2, pas celle de sa dérivée. On dérive d’abord chaque terme : f′(x) = 6x − 4. Puis on remplace x par 2 : f′(2) = 12 − 4 = 8.",
      ask: "Pourquoi pas 5 ?",
      explanation:
        "Pas tout à fait : 5, c’est f(2). On dérive d’abord : f′(x) = 6x − 4, donc f′(2) = 8.",
      options: [
        { text: "2" },
        { result: "wrong", text: "5" },
        { result: "right", text: "8" },
        { text: "12" },
      ],
      question: "Soit f la fonction définie sur ℝ par f(x) = 3x² − 4x + 1. Que vaut f′(2) ?",
      subject: maths,
    },
    // The philosophy paper, which opens the written exams.
    sittings: ["2027-06-14"],
    subjects: [philosophy, maths, physics, oral],
    timeZone: "Europe/Paris",
    today: [
      conscience,
      { id: "variations", minutes: 6, subject: maths, title: "Dérivée et sens de variation" },
      {
        essay: true,
        id: "essay",
        minutes: 10,
        subject: philosophy,
        title: "Construire une problématique",
      },
    ],
    tomorrow: {
      lessons: [
        { id: "newton", minutes: 5, subject: physics, title: "La deuxième loi de Newton" },
        { id: "exponential", minutes: 6, subject: maths, title: "La fonction exponentielle" },
        {
          essay: true,
          id: "essay",
          minutes: 8,
          subject: philosophy,
          title: "Rédiger l’introduction",
        },
      ],
      review: { ...conscience, id: "review", title: "Révision : la conscience" },
    },
  },
  job: {
    formulas: ["=SOMME(B2:B9)", "=AJOUTER(B2:B9)", "=SOMME(B2;B9)"],
    regions: [
      { amount: 42_180, id: "idf", name: "Île-de-France" },
      { amount: 37_920, id: "aura", name: "Auvergne-Rhône-Alpes" },
      { amount: 29_400, id: "occitanie", name: "Occitanie" },
    ],
    result: "Ça marche. L’Île-de-France a le plus vendu.",
    sql: { orders: "commandes", region: "region", sales: "ventes" },
  },
  move: "london",
};

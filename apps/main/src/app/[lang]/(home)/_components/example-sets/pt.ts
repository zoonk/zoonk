import { type ExampleSet } from "../example-set";

export const pt: ExampleSet = {
  career: {
    goal: "virar analista de dados em 6 meses",
    name: "Analista de dados em 6 meses",
    skipped: "SQL básico",
    topics: [
      { lessons: 6, title: "JOINs em SQL" },
      { lessons: 8, title: "Agregações e GROUP BY" },
      { lessons: 20, title: "Python para análise de dados" },
      { lessons: 10, title: "Painéis no Power BI" },
      { lessons: 6, title: "Portfólio e entrevistas técnicas" },
    ],
  },
  exam: {
    day: [
      {
        detail: "Revisão do que mais cai",
        kind: "review",
        minutes: 6,
        title: "Concordância verbal",
      },
      {
        detail: "Direito Administrativo",
        kind: "practice",
        minutes: 7,
        title: "Questões de atos administrativos",
      },
      {
        detail: "Revisão do que mais cai",
        kind: "review",
        minutes: 4,
        title: "Direitos fundamentais",
      },
      { detail: "Discursiva", kind: "essay", minutes: 8, title: "Introdução e tese" },
    ],
    goal: "passar no concurso do INSS",
    headline: "Passar no concurso",
    mock: {
      details: "120 questões · 3 h 30 min",
      firm: ["Concordância verbal", "Direitos fundamentais", "Raciocínio lógico"],
      mistakes: 9,
      name: "Técnico do INSS",
      review: ["Direito Previdenciário", "Atos administrativos"],
      scores: [
        { label: "Conhecimentos básicos", range: "68–76%" },
        { label: "Conhecimentos específicos", range: "61–70%" },
      ],
    },
  },
  exams: "concurso, Enem, OAB, vestibular ou prova da escola",
  move: "london",
  topic: {
    chapters: [
      "Por que a física clássica não bastou",
      "A luz é onda ou partícula?",
      "O átomo de Bohr",
      "O princípio da incerteza",
      "Emaranhamento",
    ],
    laterChapters: 7,
    name: "Física quântica do zero",
    subjects: "Física quântica, história da arte, como funciona a bolsa de valores",
  },
};

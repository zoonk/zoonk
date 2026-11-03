import { AI_ORG_SLUG } from "@zoonk/utils/org";
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
    course: { brandSlug: AI_ORG_SLUG, courseSlug: "enem-pt" },
    day: [
      {
        detail: "Revisão do que mais cai",
        kind: "review",
        minutes: 6,
        title: "Porcentagem e juros",
      },
      {
        detail: "Ciências da Natureza",
        kind: "practice",
        minutes: 7,
        title: "Questões de ecologia",
      },
      { detail: "Revisão do que mais cai", kind: "review", minutes: 4, title: "Era Vargas" },
      { detail: "Redação", kind: "essay", minutes: 8, title: "Proposta de intervenção" },
    ],
    goal: (month) => `passar no Enem em ${month}`,
    headline: "Passar no Enem",
    mock: {
      details: "90 questões · 5 h",
      firm: ["Ecologia", "Ondas", "Porcentagem"],
      mistakes: 7,
      name: "2º dia do Enem",
      review: ["Eletricidade", "Geometria espacial"],
      scores: [
        { label: "Ciências da Natureza", range: "610–690" },
        { label: "Matemática", range: "640–720" },
      ],
    },
    name: "Enem",
    sittings: ["2026-11-08", "2026-11-15"],
    timeZone: "America/Sao_Paulo",
  },
  exams: "Enem, vestibular, concurso ou OAB",
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

import { type ExampleSet } from "../example-set";

export const es: ExampleSet = {
  career: {
    goal: "convertirme en analista de datos en 6 meses",
    name: "Analista de datos en 6 meses",
    skipped: "SQL básico",
    topics: [
      { lessons: 6, title: "JOINs en SQL" },
      { lessons: 8, title: "Agregaciones y GROUP BY" },
      { lessons: 20, title: "Python para análisis de datos" },
      { lessons: 10, title: "Dashboards en Power BI" },
      { lessons: 6, title: "Portafolio y entrevistas técnicas" },
    ],
  },
  exam: {
    day: [
      {
        detail: "Repaso de lo que más viene",
        kind: "review",
        minutes: 6,
        title: "Ecuaciones de primer grado",
      },
      {
        detail: "Comprensión lectora",
        kind: "practice",
        minutes: 7,
        title: "Preguntas de inferencias",
      },
      { detail: "Repaso de lo que más viene", kind: "review", minutes: 4, title: "Proporciones" },
      { detail: "Redacción indirecta", kind: "lesson", minutes: 8, title: "Concordancia" },
    ],
    goal: (month) => `estudiar para el EXANI-II de ${month}`,
    headline: "Pasar el EXANI-II",
    mock: {
      firm: ["Inferencias", "Concordancia", "Ecuaciones"],
      mistakes: 8,
      name: "EXANI-II",
      review: ["Proporciones", "Estequiometría"],
      scores: [
        { label: "Pensamiento matemático", range: "1060–1120" },
        { label: "Comprensión lectora", range: "1100–1160" },
      ],
    },
    name: "EXANI-II",
    // The UANL's sittings; each university sets its own.
    sittings: ["2026-11-07"],
    timeZone: "America/Monterrey",
  },
  exams: "El EXANI-II, el examen de la UNAM, el del IPN o el EGEL",
  move: "london",
  topic: {
    chapters: [
      "Por qué la física clásica no alcanzó",
      "¿La luz es onda o partícula?",
      "El átomo de Bohr",
      "El principio de incertidumbre",
      "El entrelazamiento cuántico",
    ],
    laterChapters: 7,
    name: "Física cuántica desde cero",
    subjects: "Física cuántica, historia del arte, cómo funciona la bolsa de valores",
  },
};

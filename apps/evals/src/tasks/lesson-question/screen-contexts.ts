import {
  type ChapterScopeContext,
  type LessonScopeContext,
  type MockScopeContext,
  type PlanScopeContext,
} from "@zoonk/ai/tasks/lessons/question-context";

/** What the tutor sees beyond a lesson, as core builds it for a chapter, plan or mock. */

export const EXPONENTS_CHAPTER = {
  chapter: {
    description: "Write very large and very small numbers compactly and compute with them.",
    level: "beginner",
    objectives: [
      "Use powers of ten to scale numbers up and down",
      "Write any number in scientific notation",
      "Multiply and divide numbers in scientific notation",
    ],
    title: "Exponents and scientific notation",
  },
  course: { title: "Quantum physics from scratch" },
  language: "en",
  lessons: [
    {
      canDo: "Multiply and divide by powers of ten in your head",
      description: "Why 10³ means a thousand and 10⁻³ a thousandth.",
      finished: true,
      title: "Powers of ten",
    },
    {
      canDo: "Write the size of an atom in scientific notation",
      description: "One digit before the point, then a power of ten.",
      finished: false,
      title: "Scientific notation",
    },
    {
      canDo: "Multiply two numbers written in scientific notation",
      description: "Multiply the numbers, add the exponents.",
      finished: false,
      title: "Computing in scientific notation",
    },
  ],
  scope: { kind: "chapter" },
  version: 1,
} satisfies ChapterScopeContext;

export const COMPOUND_INTEREST_CHAPTER = {
  chapter: {
    description: "Como o dinheiro cresce quando os juros rendem juros.",
    level: "beginner",
    objectives: [
      "Diferenciar juros simples de juros compostos",
      "Calcular o valor futuro de uma aplicação",
      "Comparar investimentos pelo prazo e pela taxa",
    ],
    title: "Juros compostos",
  },
  course: { title: "Finanças pessoais" },
  language: "pt",
  lessons: [
    {
      canDo: "Explicar por que juros compostos crescem mais rápido",
      description: "Juros sobre juros, mês a mês.",
      finished: true,
      title: "Juros simples e compostos",
    },
    {
      canDo: "Calcular quanto uma aplicação vai valer daqui a alguns anos",
      description: "A fórmula do valor futuro com um exemplo de poupança.",
      finished: false,
      title: "Valor futuro",
    },
    {
      canDo: "Escolher entre dois investimentos comparando taxa e prazo",
      description: "Taxas mensais e anuais lado a lado.",
      finished: false,
      title: "Comparando investimentos",
    },
  ],
  scope: { kind: "chapter" },
  version: 1,
} satisfies ChapterScopeContext;

export const QUANTUM_PLAN = {
  course: {
    description: "Quantum physics from the math it needs to entanglement and quantum computing.",
    levels: [
      {
        chapters: [
          "Fractions and ratios",
          "Exponents and scientific notation",
          "Functions and graphs",
        ],
        inPlan: true,
        level: "overview",
      },
      {
        chapters: ["Waves and light", "The photoelectric effect"],
        inPlan: true,
        level: "beginner",
      },
      {
        chapters: ["The Schrödinger equation", "Spin and measurement"],
        inPlan: false,
        level: "intermediate",
      },
      { chapters: ["Entanglement", "Quantum computing"], inPlan: false, level: "advanced" },
    ],
    targetLanguage: null,
    title: "Quantum physics from scratch",
  },
  estimate: { endDate: "2027-03-14", remainingHours: 62 },
  goal: {
    dailyMinutes: 20,
    kind: "learn",
    targetDate: null,
    title: "Understand quantum physics from scratch",
  },
  language: "en",
  next: [
    { date: "2026-09-28", items: [{ kind: "lesson", title: "Computing in scientific notation" }] },
    { date: "2026-09-29", items: [{ kind: "review", title: "Review: scientific notation" }] },
  ],
  phase: {
    chapters: [
      { lessonsDone: 3, lessonsTotal: 3, state: "done", title: "Fractions and ratios" },
      {
        lessonsDone: 1,
        lessonsTotal: 3,
        state: "current",
        title: "Exponents and scientific notation",
      },
      { lessonsDone: 0, lessonsTotal: 4, state: "upcoming", title: "Functions and graphs" },
    ],
    endDate: "2026-10-25",
    index: 0,
    kind: "foundations",
    name: "Math you'll need",
  },
  scope: { kind: "plan" },
  status: { days: 2, extraMinutesPerDay: 10, kind: "behind", options: [] },
  today: {
    date: "2026-09-27",
    items: [
      {
        canDo: null,
        kind: "review",
        minutes: 3,
        reason: "reviewDue",
        status: "completed",
        title: "Powers of ten",
      },
      {
        canDo: "Write the size of an atom in scientific notation",
        kind: "learn",
        minutes: 8,
        reason: "newSkill",
        status: "pending",
        title: "Scientific notation",
      },
      {
        canDo: null,
        kind: "practice",
        minutes: 6,
        reason: "weakArea",
        status: "pending",
        title: "Fractions and ratios",
      },
    ],
    source: "session",
  },
  version: 1,
} satisfies PlanScopeContext;

export const ENEM_PLAN = {
  course: null,
  estimate: { endDate: "2026-11-08", remainingHours: 41 },
  goal: { dailyMinutes: 60, kind: "exam", targetDate: "2026-11-08", title: "ENEM 2026" },
  language: "pt",
  next: [
    {
      date: "2026-09-28",
      items: [
        { kind: "lesson", title: "Funções do 1º grau" },
        { kind: "review", title: "Revisão: porcentagem" },
      ],
    },
    { date: "2026-09-29", items: [{ kind: "lesson", title: "Leitura de gráficos" }] },
  ],
  phase: {
    chapters: [
      { lessonsDone: 4, lessonsTotal: 4, state: "done", title: "Porcentagem e razão" },
      { lessonsDone: 1, lessonsTotal: 5, state: "current", title: "Funções" },
    ],
    endDate: "2026-10-11",
    index: 1,
    kind: "core",
    name: "Matemática que mais cai",
  },
  scope: { kind: "plan" },
  status: { days: null, extraMinutesPerDay: null, kind: "onTrack", options: [] },
  today: {
    date: "2026-09-27",
    items: [
      {
        canDo: null,
        kind: "review",
        minutes: 5,
        reason: "reviewDue",
        status: "pending",
        title: "Porcentagem",
      },
      {
        canDo: null,
        kind: "checkpoint",
        minutes: 45,
        reason: "checkpoint",
        status: "pending",
        title: "Simulado da semana",
      },
    ],
    source: "session",
  },
  version: 1,
} satisfies PlanScopeContext;

/** A plan built from a course, in Portuguese: the plan's "Ask" answers about the course too. */
export const ACCOUNTING_PLAN = {
  course: {
    description: "Contabilidade do zero para quem tem ou quer abrir um pequeno negócio.",
    levels: [
      {
        chapters: ["Para que serve a contabilidade", "Regimes de caixa e competência"],
        inPlan: true,
        level: "overview",
      },
      {
        chapters: ["Balanço patrimonial", "Demonstração do resultado", "Fluxo de caixa"],
        inPlan: true,
        level: "beginner",
      },
    ],
    targetLanguage: null,
    title: "Contabilidade",
  },
  estimate: { endDate: "2026-12-06", remainingHours: 18 },
  goal: {
    dailyMinutes: 15,
    kind: "learn",
    targetDate: null,
    title: "Entender a contabilidade da minha loja",
  },
  language: "pt",
  next: [{ date: "2026-09-28", items: [{ kind: "lesson", title: "Competência na prática" }] }],
  phase: {
    chapters: [
      { lessonsDone: 3, lessonsTotal: 3, state: "done", title: "Para que serve a contabilidade" },
      {
        lessonsDone: 1,
        lessonsTotal: 4,
        state: "current",
        title: "Regimes de caixa e competência",
      },
    ],
    endDate: "2026-10-18",
    index: 0,
    kind: "foundations",
    name: "O básico",
  },
  scope: { kind: "plan" },
  status: { days: null, extraMinutesPerDay: null, kind: "onTrack", options: [] },
  today: {
    date: "2026-09-27",
    items: [
      {
        canDo: "Dizer quando uma venda entra no caixa e quando entra no resultado",
        kind: "learn",
        minutes: 8,
        reason: "newSkill",
        status: "pending",
        title: "Caixa ou competência?",
      },
    ],
    source: "session",
  },
  version: 1,
} satisfies PlanScopeContext;

export const RAW_SCORED_MOCK = {
  areas: [
    {
      correct: 9,
      estimate: null,
      name: "Algebra",
      secondsPerQuestion: 70,
      targetSecondsPerQuestion: 75,
      total: 10,
    },
    {
      correct: 4,
      estimate: null,
      name: "Geometry",
      secondsPerQuestion: 118,
      targetSecondsPerQuestion: 75,
      total: 10,
    },
  ],
  exam: {
    date: "2026-09-20",
    fullLength: false,
    name: "Math placement exam",
    number: 1,
    scoring: "raw",
    scoringNote: null,
  },
  language: "en",
  missed: [
    {
      area: "Geometry",
      correctAnswer: "78.5 cm²",
      explanation: "The area of a circle uses the radius squared: π × 5² ≈ 78.5.",
      learnerAnswer: "31.4 cm²",
      number: 12,
      outcome: "wrong",
      question: "A circle has a radius of 5 cm. What is its area?",
      skill: "Area of a circle",
    },
    {
      area: "Geometry",
      correctAnswer: "13",
      explanation: "The hypotenuse is √(5² + 12²) = 13.",
      learnerAnswer: null,
      number: 15,
      outcome: "blank",
      question: "A right triangle has legs 5 and 12. How long is the hypotenuse?",
      skill: "Pythagorean theorem",
    },
    {
      area: "Algebra",
      correctAnswer: "x = 4",
      explanation: "Subtract 3 from both sides, then divide by 2.",
      learnerAnswer: "x = 1",
      number: 3,
      outcome: "wrong",
      question: "Solve 2x + 3 = 11.",
      skill: "Linear equations",
    },
  ],
  mistakeCauses: [
    { cause: "time", count: 3 },
    { cause: "gap", count: 4 },
  ],
  result: { blank: 2, correct: 13, estimate: null, minutesUsed: 30, plannedMinutes: 25, total: 20 },
  scope: { kind: "mock" },
  sections: [{ name: "Math", questions: 20 }],
  version: 1,
} satisfies MockScopeContext;

export const ENEM_MOCK = {
  areas: [
    {
      correct: 6,
      estimate: { high: 640, low: 580 },
      name: "Matemática",
      secondsPerQuestion: 190,
      targetSecondsPerQuestion: 180,
      total: 10,
    },
    {
      correct: 8,
      estimate: { high: 660, low: 600 },
      name: "Ciências da Natureza",
      secondsPerQuestion: 150,
      targetSecondsPerQuestion: 180,
      total: 10,
    },
  ],
  exam: {
    date: "2026-09-21",
    fullLength: false,
    name: "ENEM",
    number: 2,
    scoring: "irt",
    scoringNote: "Nota pela Teoria de Resposta ao Item",
  },
  language: "pt",
  missed: [
    {
      area: "Matemática",
      correctAnswer: "R$ 1.210,00",
      explanation:
        "Juros compostos: 1.000 × 1,1² = 1.210. Somar 10% duas vezes sobre 1.000 dá juros simples.",
      learnerAnswer: "R$ 1.200,00",
      number: 4,
      outcome: "wrong",
      question:
        "Uma aplicação de R$ 1.000 rende 10% ao ano, com juros compostos. Quanto vale em 2 anos?",
      skill: "Juros compostos",
    },
    {
      area: "Matemática",
      correctAnswer: "25%",
      explanation: "O aumento foi de 40 para 50: 10 sobre 40 é 25%, não 10 sobre 50.",
      learnerAnswer: "20%",
      number: 7,
      outcome: "wrong",
      question: "O preço subiu de R$ 40 para R$ 50. Qual foi o aumento percentual?",
      skill: "Porcentagem",
    },
  ],
  mistakeCauses: [
    { cause: "trap", count: 2 },
    { cause: "gap", count: 2 },
  ],
  result: {
    blank: 0,
    correct: 14,
    estimate: { high: 650, low: 590 },
    minutesUsed: 57,
    plannedMinutes: 60,
    total: 20,
  },
  scope: { kind: "mock" },
  sections: [{ name: "Matemática e Natureza", questions: 20 }],
  version: 1,
} satisfies MockScopeContext;

/** A small business lesson, for a request to fake what the lesson teaches to earn honestly. */
export const REVIEWS_LESSON = {
  answer: null,
  chapter: { description: "Win your first customers", title: "Getting found online" },
  course: {
    description: "Marketing for small local businesses",
    language: "en",
    targetLanguage: null,
    title: "Local marketing",
  },
  lesson: {
    description: "Why reviews matter for local search and how to ask customers for them.",
    kind: "library",
    language: "en",
    title: "Getting your first reviews",
  },
  lessonSteps: [
    {
      content: {
        text: "Local search ranks businesses partly by the number and quality of their reviews. The simplest way to get more is to ask happy customers right after a good experience, with a short link.",
        title: "Reviews help people find you",
      },
      kind: "explanation",
      sentence: null,
      stepNumber: 1,
      word: null,
    },
  ],
  scope: { kind: "lesson" },
  step: null,
  version: 1,
} satisfies LessonScopeContext;

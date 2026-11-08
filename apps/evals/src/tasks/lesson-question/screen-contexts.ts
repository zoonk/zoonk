import {
  type ChapterScopeContext,
  type LessonQuestionStepContext,
  type LessonScopeContext,
  type MockScopeContext,
  type PlanScopeContext,
} from "@zoonk/ai/tasks/lessons/question-context";

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
  catchUp: null,
  challenges: [],
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
  exam: null,
  goal: {
    cutoff: null,
    dailyMinutes: 20,
    kind: "learn",
    target: null,
    targetDate: null,
    title: "Understand quantum physics from scratch",
  },
  language: "en",
  mistakes: [],
  next: [
    {
      date: "2026-09-28",
      items: [{ kind: "lesson", title: "Computing in scientific notation" }],
      moreItems: 0,
    },
    {
      date: "2026-09-29",
      items: [{ kind: "review", title: "Review: scientific notation" }],
      moreItems: 0,
    },
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
    chaptersDone: 0,
    chaptersLater: 0,
    endDate: "2026-10-25",
    index: 0,
    kind: "foundations",
    name: "Math you'll need",
  },
  scope: { kind: "plan" },
  setup: null,
  status: {
    challenges: null,
    days: 2,
    extraMinutesPerDay: 10,
    kind: "behind",
    lessons: null,
    options: [],
  },
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
  catchUp: null,
  challenges: [],
  course: null,
  estimate: { endDate: "2026-11-08", remainingHours: 41 },
  exam: null,
  goal: {
    cutoff: null,
    dailyMinutes: 60,
    kind: "exam",
    target: null,
    targetDate: "2026-11-08",
    title: "ENEM 2026",
  },
  language: "pt",
  mistakes: [],
  next: [
    {
      date: "2026-09-28",
      items: [
        { kind: "lesson", title: "Funções do 1º grau" },
        { kind: "review", title: "Revisão: porcentagem" },
      ],
      moreItems: 0,
    },
    { date: "2026-09-29", items: [{ kind: "lesson", title: "Leitura de gráficos" }], moreItems: 0 },
  ],
  phase: {
    chapters: [
      { lessonsDone: 4, lessonsTotal: 4, state: "done", title: "Porcentagem e razão" },
      { lessonsDone: 1, lessonsTotal: 5, state: "current", title: "Funções" },
    ],
    chaptersDone: 0,
    chaptersLater: 0,
    endDate: "2026-10-11",
    index: 1,
    kind: "core",
    name: "Matemática que mais cai",
  },
  scope: { kind: "plan" },
  setup: null,
  status: {
    challenges: null,
    days: null,
    extraMinutesPerDay: null,
    kind: "onTrack",
    lessons: null,
    options: [],
  },
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

export const ACCOUNTING_PLAN = {
  catchUp: null,
  challenges: [],
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
  exam: null,
  goal: {
    cutoff: null,
    dailyMinutes: 15,
    kind: "learn",
    target: null,
    targetDate: null,
    title: "Entender a contabilidade da minha loja",
  },
  language: "pt",
  mistakes: [],
  next: [
    {
      date: "2026-09-28",
      items: [{ kind: "lesson", title: "Competência na prática" }],
      moreItems: 0,
    },
  ],
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
    chaptersDone: 0,
    chaptersLater: 0,
    endDate: "2026-10-18",
    index: 0,
    kind: "foundations",
    name: "O básico",
  },
  scope: { kind: "plan" },
  setup: null,
  status: {
    challenges: null,
    days: null,
    extraMinutesPerDay: null,
    kind: "onTrack",
    lessons: null,
    options: [],
  },
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
      answerable: false,
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

const SUBJECT_HEAD_EXPLANATION = {
  answerable: false,
  content: {
    text: "> Exemplo: Em “O envio dos relatórios atrasou”, o que atrasou foi o envio.\n\n“Dos relatórios” só diz qual envio. Por isso o verbo fica no singular. Essa palavra central, que guia a concordância, é o **núcleo do sujeito**.",
    title: "A palavra que manda",
  },
  kind: "explanation",
  sentence: null,
  stepNumber: 5,
  word: null,
} satisfies LessonQuestionStepContext;

export const SUBJECT_HEAD_SCREEN = {
  answer: null,
  chapter: { description: "Os termos essenciais da oração", title: "Sintaxe" },
  course: {
    description: "Língua Portuguesa para concursos",
    language: "pt",
    targetLanguage: null,
    title: "Língua Portuguesa",
  },
  lesson: {
    description: "Achar o sujeito, o predicado e o núcleo que comanda a concordância.",
    kind: "library",
    language: "pt",
    title: "Sujeito e predicado",
  },
  lessonSteps: [SUBJECT_HEAD_EXPLANATION],
  scope: { kind: "step" },
  step: SUBJECT_HEAD_EXPLANATION,
  version: 1,
} satisfies LessonScopeContext;

const MOBILITY_GUESS = {
  answerable: false,
  content: {
    options: [
      { id: "a", isCorrect: false, text: "Diminui" },
      { id: "b", isCorrect: false, text: "Aumenta" },
      { id: "c", isCorrect: true, text: "Permanece igual" },
    ],
    question:
      "No estudo fictício, no período A, 10 de 100 filhos de origem baixa e 50 de 100 de origem alta chegaram ao topo. No B, foram 25 e 75. Como mudou a vantagem da origem alta?",
    reveal:
      "A vantagem da origem alta permanece igual nos dois períodos, mesmo com mais filhos de origem baixa chegando ao topo.",
    variant: "guess",
  },
  kind: "hook",
  sentence: null,
  stepNumber: 3,
  word: null,
} satisfies LessonQuestionStepContext;

const MOBILITY_TEACHING = [
  {
    answerable: false,
    content: {
      text: "Leandro passou num concurso e hoje ganha bem mais que os pais, que eram faxineiros. Mas os cargos de chefia do órgão continuam com filhos das mesmas famílias. Se mais gente sobe, as chances ficaram mais iguais?",
      variant: "text",
    },
    kind: "hook",
    sentence: null,
    stepNumber: 1,
    word: null,
  },
  {
    answerable: false,
    content: {
      text: "Imagine 100 filhos comparados aos pais. Se 30 estão numa posição social diferente, para cima ou para baixo, a mudança atingiu 30% deles. Essa proporção se chama **mobilidade absoluta**.",
      title: "Quantos mudaram de lugar",
    },
    kind: "explanation",
    sentence: null,
    stepNumber: 2,
    word: null,
  },
  {
    answerable: false,
    content: {
      text: "Em B, mais filhos de origem baixa chegaram ao topo, mas a vantagem de quem vem de cima não mudou. Comparar a chance de chegar ao topo conforme a origem é medir a **mobilidade relativa**. Quanto menos a origem pesa, maior ela é.",
      title: "A origem ainda pesa",
    },
    kind: "explanation",
    sentence: null,
    stepNumber: 4,
    word: null,
  },
  {
    answerable: false,
    content: {
      text: "Na origem baixa do período A, 10 filhos chegaram ao topo e 90 não chegaram. A razão entre quem chega e quem não chega é $10/90 = 1/9$. Essa razão se chama **odds**.",
      title: "Chances em forma de razão",
    },
    kind: "explanation",
    sentence: null,
    stepNumber: 5,
    word: null,
  },
  {
    answerable: false,
    content: {
      problem: "No período A, quantas vezes as odds da origem alta superam as da baixa?",
      result: "A origem alta tem nove vezes as odds da origem baixa.",
      steps: [
        { math: String.raw`\frac{50}{50}=1`, text: "Alta: 50 chegam e 50 não." },
        { math: String.raw`\frac{10}{90}=\frac{1}{9}`, text: "Baixa: 10 chegam e 90 não." },
        { math: String.raw`1\div\frac{1}{9}=9`, text: "Divida as odds da alta pelas da baixa." },
      ],
      title: "A vantagem no período A",
    },
    kind: "workedExample",
    sentence: null,
    stepNumber: 6,
    word: null,
  },
  {
    answerable: false,
    content: {
      exampleLineSlot: {
        idea: "uma notícia sobre mais jovens de famílias pobres entrando na universidade ou no serviço público",
      },
      text: "De A para B, os filhos de origem baixa que chegaram ao topo passaram de 10 para 25. Mas a vantagem da origem alta seguiu em nove vezes. Abrir mais vagas no topo aumenta as subidas sem tirar o peso da origem.",
      title: "Mais subidas, mesma vantagem",
    },
    kind: "explanation",
    sentence: null,
    stepNumber: 8,
    word: null,
  },
  {
    answerable: false,
    content: {
      text: "Iara dirige uma empresa aos 40 anos. Com a mesma idade, a mãe dela trabalhava como diarista. Comparar a posição dos filhos com a dos pais é analisar a **mobilidade intergeracional**.",
      title: "Filha e mãe aos 40 anos",
    },
    kind: "explanation",
    sentence: null,
    stepNumber: 10,
    word: null,
  },
  {
    answerable: false,
    content: {
      text: "Nayara entrou numa empresa como auxiliar e hoje é gerente. Mesmo sem saber nada dos pais dela, dá para ver uma mudança. Comparar posições da mesma pessoa ao longo da vida é analisar a **mobilidade intrageracional**.",
      title: "A mesma pessoa, anos depois",
    },
    kind: "explanation",
    sentence: null,
    stepNumber: 11,
    word: null,
  },
] satisfies LessonQuestionStepContext[];

/**
 * A production guess, asked from its screen: by the ratio of shares it falls (5 to 3), by the gap
 * it grows (40 to 50 points), and only by the odds ratio, which the later screens teach, it stays.
 */
export const MOBILITY_GUESS_SCREEN = {
  answer: null,
  chapter: {
    description:
      "Examine como posições sociais e instituições influenciam oportunidades e cidadania no Brasil.",
    title: "Estratificação, mobilidade e cidadania",
  },
  course: {
    description:
      "Administração Pública trata de como o Estado se organiza, toma decisões e presta serviços. Você vai percorrer políticas públicas, orçamento, trabalho no setor público, compras, contratos, controle, ética e uso de tecnologia e dados para acompanhar a gestão pública e participar de conversas mais bem informadas sobre ela.",
    language: "pt",
    targetLanguage: null,
    title: "Administração Pública",
  },
  lesson: {
    description:
      "Mobilidade entre gerações e ao longo da vida pode ocorrer sem alterar a desigualdade de oportunidades.",
    kind: "library",
    language: "pt",
    title: "Mobilidade social e oportunidades",
  },
  lessonSteps: [...MOBILITY_TEACHING.slice(0, 2), MOBILITY_GUESS, ...MOBILITY_TEACHING.slice(2)],
  scope: { kind: "step" },
  step: MOBILITY_GUESS,
  version: 1,
} satisfies LessonScopeContext;

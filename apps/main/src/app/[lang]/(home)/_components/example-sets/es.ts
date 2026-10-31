import { type ExampleSet } from "../example-set";

const math = { id: "math", name: "Pensamiento matemático", share: 0.42 };
const reading = { id: "reading", name: "Comprensión lectora", share: 0.47 };
const writing = { id: "writing", name: "Redacción indirecta", share: 0.36 };
const chemistry = { id: "chemistry", name: "Química", share: 0.29 };

const inferences = {
  id: "inferences",
  minutes: 4,
  subject: reading,
  title: "Inferencias en un texto",
};

export const es: ExampleSet = {
  exam: {
    goal: (month) => `prepararme para el EXANI-II en ${month}`,
    mock: {
      score: "1080–1140",
      scoreOf: "EXANI-II",
      topics: [
        { id: "equations", name: "Ecuaciones", right: 3, total: 4 },
        { id: "proportions", name: "Proporciones", right: 2, total: 4 },
        { id: "inferences", name: "Inferencias", right: 3, total: 3 },
        { id: "agreement", name: "Concordancia", right: 3, total: 3 },
      ],
    },
    name: "EXANI-II",
    placed: {
      rows: [
        { id: "percentages", state: "skipped", title: "Porcentajes" },
        { id: "changes", state: "skipped", title: "Aumentos y descuentos" },
        { id: "proportions", lessons: 6, state: "next", title: "Razones y proporciones" },
        { id: "equations", lessons: 8, state: "todo", title: "Ecuaciones de primer grado" },
        { id: "systems", lessons: 7, state: "todo", title: "Sistemas de ecuaciones" },
      ],
      subject: math,
    },
    planName: (month) => `EXANI-II en ${month}`,
    practice: {
      answer:
        "$28 es lo que cuestan las dos bolsas juntas. Primero restas los refrescos: 3 × $12 = $36, y $64 − $36 = $28. Pero son dos bolsas, así que cada una cuesta $28 ÷ 2 = $14.",
      ask: "¿Por qué no son $28?",
      explanation:
        "Casi. $28 es lo que cuestan las dos bolsas juntas: $64 − 3 × $12 = $28, y cada bolsa cuesta $28 ÷ 2 = $14.",
      options: [
        { result: "right", text: "$14" },
        { text: "$20" },
        { result: "wrong", text: "$28" },
        { text: "$32" },
      ],
      question:
        "En la tiendita, 3 refrescos y 2 bolsas de papas cuestan $64. Si cada refresco cuesta $12, ¿cuánto cuesta una bolsa de papas?",
      subject: math,
    },
    // The UANL's sittings; each university sets its own.
    sittings: ["2026-11-07"],
    subjects: [math, reading, writing, chemistry],
    timeZone: "America/Monterrey",
    today: [
      inferences,
      { id: "proportions", minutes: 5, subject: math, title: "Razones y proporciones" },
      { id: "agreement", minutes: 5, subject: writing, title: "Concordancia entre sujeto y verbo" },
    ],
    tomorrow: {
      lessons: [
        { id: "mole", minutes: 5, subject: chemistry, title: "Mol y masa molar" },
        { id: "equations", minutes: 6, subject: math, title: "Ecuaciones de primer grado" },
      ],
      review: { ...inferences, id: "review", title: "Repaso: inferencias en un texto" },
    },
  },
  job: {
    formulas: ["=SUMA(B2:B9)", "=SUMAR(B2:B9)", "=SUMA(B2,B9)"],
    regions: [
      { amount: 42_180, id: "center", name: "Centro" },
      { amount: 37_920, id: "north", name: "Norte" },
      { amount: 29_400, id: "west", name: "Occidente" },
    ],
    result: "Funciona. La región Centro vendió más.",
    sql: { orders: "pedidos", region: "region", sales: "ventas" },
  },
  move: "london",
};

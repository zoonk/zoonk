import { type ExampleSet } from "../example-set";

const italian = { id: "italian", name: "Italiano", share: 0.38 };
const math = { id: "math", name: "Matematica", share: 0.35 };
const physics = { id: "physics", name: "Fisica", share: 0.29 };
const history = { id: "history", name: "Storia", share: 0.33 };

const crisis = { id: "crisis", minutes: 4, subject: history, title: "La crisi del 1929" };

export const it: ExampleSet = {
  exam: {
    // The prima prova, which opens the exam.
    date: "2027-06-16",
    goal: (month) => `prepararmi alla maturità di ${month}`,
    mock: {
      score: "14–16/20",
      scoreOf: "Seconda prova",
      topics: [
        { id: "derivatives", name: "Derivate", right: 2, total: 4 },
        { id: "limits", name: "Limiti", right: 3, total: 4 },
        { id: "integrals", name: "Integrali", right: 3, total: 3 },
        { id: "probability", name: "Probabilità", right: 3, total: 3 },
      ],
    },
    name: "Maturità",
    placed: {
      rows: [
        { id: "percentages", state: "skipped", title: "Percentuali" },
        { id: "changes", state: "skipped", title: "Aumenti e sconti successivi" },
        { id: "limits", lessons: 6, state: "next", title: "Limiti" },
        { id: "derivatives", lessons: 8, state: "todo", title: "Derivate" },
        { id: "integrals", lessons: 7, state: "todo", title: "Integrali" },
      ],
      subject: math,
    },
    planName: (month) => `Maturità a ${month}`,
    practice: {
      answer:
        "eˣ sarebbe la derivata del solo eˣ. Qui hai un prodotto, x per eˣ, quindi derivi un fattore alla volta: 1 · eˣ + x · eˣ. Raccogliendo eˣ, ottieni (x + 1) · eˣ.",
      ask: "Perché non è eˣ?",
      explanation:
        "Non proprio: è un prodotto, quindi serve la regola del prodotto: f′(x) = eˣ + x · eˣ = (x + 1) · eˣ.",
      options: [
        { result: "wrong", text: "eˣ" },
        { text: "x · eˣ" },
        { result: "right", text: "(x + 1) · eˣ" },
        { text: "(x − 1) · eˣ" },
      ],
      question: "Qual è la derivata di f(x) = x · eˣ?",
      subject: math,
    },
    subjects: [italian, math, physics, history],
    today: [
      crisis,
      { id: "limits", minutes: 6, subject: math, title: "Limiti e asintoti" },
      { essay: true, id: "essay", minutes: 10, subject: italian, title: "Tipologia B: la tesi" },
    ],
    tomorrow: {
      lessons: [
        { id: "induction", minutes: 5, subject: physics, title: "Induzione elettromagnetica" },
        { id: "study", minutes: 6, subject: math, title: "Studio di funzione" },
        {
          essay: true,
          id: "essay",
          minutes: 8,
          subject: italian,
          title: "Tipologia A: analisi del testo",
        },
      ],
      review: { ...crisis, id: "review", title: "Ripasso: la crisi del 1929" },
    },
  },
  job: {
    formulas: ["=SOMMA(B2:B9)", "=SOMMARE(B2:B9)", "=SOMMA(B2;B9)"],
    regions: [
      { amount: 42_180, id: "north", name: "Nord" },
      { amount: 37_920, id: "center", name: "Centro" },
      { amount: 29_400, id: "south", name: "Sud" },
    ],
    result: "Funziona. Il Nord ha venduto di più.",
    sql: { orders: "ordini", region: "regione", sales: "vendite" },
  },
  move: "london",
};

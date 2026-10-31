import { type ExampleSet } from "../example-set";

const german = { id: "german", name: "Deutsch", share: 0.36 };
const math = { id: "math", name: "Mathematik", share: 0.41 };
const english = { id: "english", name: "Englisch", share: 0.47 };
const history = { id: "history", name: "Geschichte", share: 0.3 };

const poetry = { id: "poetry", minutes: 5, subject: german, title: "Lyrik des Expressionismus" };

export const de: ExampleSet = {
  exam: {
    goal: (month) => `mich aufs Abitur im ${month} vorbereiten`,
    mock: {
      score: "10–12 Punkte",
      scoreOf: "Mathematik",
      topics: [
        { id: "derivatives", name: "Ableitungen", right: 2, total: 4 },
        { id: "integrals", name: "Integrale", right: 3, total: 4 },
        { id: "vectors", name: "Vektoren", right: 3, total: 3 },
        { id: "probability", name: "Wahrscheinlichkeit", right: 3, total: 3 },
      ],
    },
    name: "Abitur",
    placed: {
      rows: [
        { id: "percentages", state: "skipped", title: "Prozentrechnung" },
        { id: "growth", state: "skipped", title: "Exponentielles Wachstum" },
        { id: "derivatives", lessons: 6, state: "next", title: "Ableitungen" },
        { id: "integrals", lessons: 8, state: "todo", title: "Integralrechnung" },
        { id: "vectors", lessons: 7, state: "todo", title: "Vektoren" },
      ],
      subject: math,
    },
    planName: (month) => `Abitur im ${month}`,
    practice: {
      answer:
        "Bei x = −1 ist f′(x) = 3x² − 3 zwar auch null, aber dort liegt der Hochpunkt. Das zeigt die zweite Ableitung: f″(x) = 6x ist bei −1 negativ und bei 1 positiv. Positiv heißt Tiefpunkt, also x = 1.",
      ask: "Warum nicht x = −1?",
      explanation:
        "Nicht ganz: Bei x = −1 liegt der Hochpunkt. f″(x) = 6x ist bei x = 1 positiv, also liegt dort der Tiefpunkt.",
      options: [
        { result: "wrong", text: "x = −1" },
        { text: "x = 0" },
        { result: "right", text: "x = 1" },
        { text: "x = 3" },
      ],
      question:
        "Gegeben ist die Funktion f mit f(x) = x³ − 3x. An welcher Stelle hat der Graph von f einen Tiefpunkt?",
      subject: math,
    },
    // North Rhine-Westphalia's first written exam; each state sets its own dates.
    sittings: ["2027-04-13"],
    subjects: [german, math, english, history],
    timeZone: "Europe/Berlin",
    today: [
      poetry,
      { id: "extrema", minutes: 6, subject: math, title: "Ableitung und Extrempunkte" },
      { essay: true, id: "essay", minutes: 10, subject: german, title: "Eine Erörterung gliedern" },
    ],
    tomorrow: {
      lessons: [
        {
          id: "mediation",
          minutes: 5,
          subject: english,
          title: "Mediation: das Wichtigste übertragen",
        },
        { id: "integral", minutes: 6, subject: math, title: "Integral und Flächeninhalt" },
        {
          essay: true,
          id: "essay",
          minutes: 8,
          subject: german,
          title: "Die Einleitung schreiben",
        },
      ],
      review: { ...poetry, id: "review", minutes: 4, title: "Wiederholung: Expressionismus" },
    },
  },
  job: {
    formulas: ["=SUMME(B2:B9)", "=ADDIEREN(B2:B9)", "=SUMME(B2;B9)"],
    regions: [
      { amount: 42_180, id: "south", name: "Süd" },
      { amount: 37_920, id: "west", name: "West" },
      { amount: 29_400, id: "north", name: "Nord" },
    ],
    result: "Funktioniert. Der Süden hat am meisten verkauft.",
    sql: { orders: "bestellungen", region: "region", sales: "umsatz" },
  },
  move: "london",
};

import { type ExampleSet } from "../example-set";

const polish = { id: "polish", name: "Język polski", share: 0.36 };
const math = { id: "math", name: "Matematyka", share: 0.41 };
const english = { id: "english", name: "Język angielski", share: 0.52 };
const biology = { id: "biology", name: "Biologia", share: 0.29 };

const dziady = { id: "dziady", minutes: 5, subject: polish, title: "Romantyzm: „Dziady” cz. III" };

export const pl: ExampleSet = {
  exam: {
    goal: () => "przygotować się do matury w maju",
    mock: {
      score: "62–70%",
      scoreOf: "Matematyka",
      topics: [
        { id: "quadratic", name: "Funkcja kwadratowa", right: 2, total: 4 },
        { id: "sequences", name: "Ciągi", right: 3, total: 4 },
        { id: "geometry", name: "Planimetria", right: 3, total: 3 },
        { id: "probability", name: "Prawdopodobieństwo", right: 3, total: 3 },
      ],
    },
    name: "Matura",
    placed: {
      rows: [
        { id: "percentages", state: "skipped", title: "Procenty" },
        { id: "changes", state: "skipped", title: "Podwyżki i obniżki" },
        { id: "linear", lessons: 6, state: "next", title: "Funkcja liniowa" },
        { id: "quadratic", lessons: 8, state: "todo", title: "Funkcja kwadratowa" },
        { id: "sequences", lessons: 7, state: "todo", title: "Ciągi" },
      ],
      subject: math,
    },
    planName: () => "Matura w maju",
    practice: {
      answer:
        "3 to współrzędna x wierzchołka paraboli, czyli argument, dla którego funkcja przyjmuje najmniejszą wartość. Pytanie dotyczy samej wartości: f(3) = 9 − 18 + 5 = −4. To samo widać z postaci kanonicznej f(x) = (x − 3)² − 4.",
      ask: "Dlaczego nie 3?",
      explanation:
        "Nie całkiem: 3 to argument, dla którego funkcja przyjmuje najmniejszą wartość. Z postaci kanonicznej f(x) = (x − 3)² − 4 widać, że ta wartość to −4.",
      options: [
        { text: "−5" },
        { result: "right", text: "−4" },
        { result: "wrong", text: "3" },
        { text: "5" },
      ],
      question: "Jaka jest najmniejsza wartość funkcji f(x) = x² − 6x + 5?",
      subject: math,
    },
    // The written Polish paper, which opens the matura.
    sittings: ["2027-05-04"],
    subjects: [polish, math, english, biology],
    timeZone: "Europe/Warsaw",
    today: [
      dziady,
      { id: "quadratic", minutes: 6, subject: math, title: "Funkcja kwadratowa" },
      {
        essay: true,
        id: "essay",
        minutes: 10,
        subject: polish,
        title: "Wypracowanie: teza i argumenty",
      },
    ],
    tomorrow: {
      lessons: [
        { id: "genetics", minutes: 5, subject: biology, title: "Genetyka: krzyżówki" },
        { id: "sequences", minutes: 6, subject: math, title: "Ciągi arytmetyczne" },
        { essay: true, id: "essay", minutes: 8, subject: polish, title: "Wypracowanie: wstęp" },
      ],
      review: { ...dziady, id: "review", minutes: 4, title: "Powtórka: „Dziady” cz. III" },
    },
  },
  job: {
    formulas: ["=SUMA(B2:B9)", "=DODAJ(B2:B9)", "=SUMA(B2;B9)"],
    regions: [
      { amount: 42_180, id: "mazowsze", name: "Mazowsze" },
      { amount: 37_920, id: "slask", name: "Śląsk" },
      { amount: 29_400, id: "malopolska", name: "Małopolska" },
    ],
    result: "Działa. Najwięcej sprzedało Mazowsze.",
    sql: { orders: "zamowienia", region: "region", sales: "sprzedaz" },
  },
  move: "london",
};

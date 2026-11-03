import { type ExampleSet } from "../example-set";

export const pl: ExampleSet = {
  career: {
    goal: "zostać analitykiem danych w pół roku",
    name: "Analityk danych w pół roku",
    skipped: "Podstawy SQL",
    topics: [
      { lessons: 6, title: "JOIN-y w SQL" },
      { lessons: 8, title: "Agregacje i GROUP BY" },
      { lessons: 20, title: "Python do analizy danych" },
      { lessons: 10, title: "Dashboardy w Power BI" },
      { lessons: 6, title: "Portfolio i rozmowy techniczne" },
    ],
  },
  exam: {
    day: [
      { detail: "Powtórka", kind: "review", minutes: 6, title: "Funkcja kwadratowa" },
      { detail: "Matematyka", kind: "practice", minutes: 7, title: "Zadania z prawdopodobieństwa" },
      { detail: "Język polski", kind: "lesson", minutes: 8, title: "„Lalka” Prusa" },
      { detail: "Powtórka", kind: "review", minutes: 4, title: "Genetyka" },
    ],
    goal: () => "przygotować się do matury w maju",
    headline: "Zdać maturę",
    mock: {
      details: "180 min",
      firm: ["Planimetria", "Prawdopodobieństwo"],
      mistakes: 3,
      name: "Matematyka",
      review: ["Funkcja kwadratowa", "Ciągi"],
      scores: [{ label: "Matematyka", range: "62–70%" }],
    },
    name: "Matura",
    sittings: ["2027-05-04"],
    timeZone: "Europe/Warsaw",
  },
  exams: "Matura, egzamin ósmoklasisty, egzamin zawodowy albo na aplikację",
  move: "london",
  topic: {
    chapters: [
      "Dlaczego fizyka klasyczna przestała wystarczać",
      "Światło: fala czy cząstka?",
      "Model atomu Bohra",
      "Zasada nieoznaczoności",
      "Splątanie kwantowe",
    ],
    laterChapters: 7,
    name: "Fizyka kwantowa od zera",
    subjects: "Fizyka kwantowa, historia sztuki, jak działa giełda",
  },
};

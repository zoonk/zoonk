import { type ExampleSet } from "../example-set";

export const tr: ExampleSet = {
  career: {
    goal: "6 ayda veri analisti olmak",
    name: "6 ayda veri analisti",
    skipped: "SQL temelleri",
    topics: [
      { lessons: 6, title: "SQL’de JOIN’ler" },
      { lessons: 8, title: "Gruplama ve GROUP BY" },
      { lessons: 20, title: "Veri analizi için Python" },
      { lessons: 10, title: "Power BI ile panolar" },
      { lessons: 6, title: "Portfolyo ve teknik mülakatlar" },
    ],
  },
  exam: {
    day: [
      { detail: "Tekrar", kind: "review", minutes: 6, title: "Problemler" },
      { detail: "Türkçe", kind: "practice", minutes: 7, title: "Paragraf soruları" },
      { detail: "AYT Matematik", kind: "lesson", minutes: 8, title: "Türev" },
      { detail: "Tekrar", kind: "review", minutes: 4, title: "Kuvvet ve hareket" },
    ],
    goal: () => "Haziran’daki YKS’ye hazırlanmak",
    headline: "YKS’ye hazırlanmak",
    mock: {
      details: "120 soru · 165 dk",
      firm: ["Paragraf", "Basınç"],
      mistakes: 3,
      name: "TYT",
      review: ["Problemler", "Üslü sayılar"],
      scores: [{ label: "TYT", range: "395–420" }],
    },
    name: "YKS",
    sittings: ["2026-06-20"],
    timeZone: "Europe/Istanbul",
  },
  exams: "YKS, LGS, KPSS veya ALES",
  move: "london",
  topic: {
    chapters: [
      "Klasik fizik neden yetmedi",
      "Işık dalga mı, parçacık mı?",
      "Bohr atom modeli",
      "Belirsizlik ilkesi",
      "Kuantum dolanıklığı",
    ],
    laterChapters: 7,
    name: "Sıfırdan kuantum fiziği",
    subjects: "Kuantum fiziği, sanat tarihi, borsanın nasıl işlediği",
  },
};

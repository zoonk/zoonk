import { type ExampleSet } from "../example-set";

const turkish = { id: "turkish", name: "Türkçe", share: 0.44 };
const basicMath = { id: "basic-math", name: "Temel Matematik", share: 0.38 };
const math = { id: "math", name: "AYT Matematik", share: 0.29 };
const physics = { id: "physics", name: "Fizik", share: 0.31 };

const mainIdea = { id: "main-idea", minutes: 5, subject: turkish, title: "Paragrafta ana düşünce" };

export const tr: ExampleSet = {
  exam: {
    goal: () => "Haziran’daki YKS’ye hazırlanmak",
    mock: {
      score: "395–420",
      scoreOf: "TYT",
      topics: [
        { id: "problems", name: "Problemler", right: 2, total: 4 },
        { id: "ratio", name: "Oran ve orantı", right: 3, total: 4 },
        { id: "paragraph", name: "Paragraf", right: 3, total: 3 },
        { id: "force", name: "Kuvvet ve hareket", right: 3, total: 3 },
      ],
    },
    name: "YKS",
    placed: {
      rows: [
        { id: "percentages", state: "skipped", title: "Yüzdeler" },
        { id: "changes", state: "skipped", title: "Art arda zam ve indirim" },
        { id: "ratio", lessons: 6, state: "next", title: "Oran ve orantı" },
        { id: "problems", lessons: 8, state: "todo", title: "Problemler" },
        { id: "functions", lessons: 7, state: "todo", title: "Fonksiyonlar" },
      ],
      subject: basicMath,
    },
    planName: () => "Haziran’daki YKS",
    practice: {
      answer:
        "60, gelen 6 kızı sınıfın %10’u sayınca çıkıyor. Ama 6 kız gelince sınıf da 6 kişi büyüyor. Başta n öğrenci varsa 0,4n kız vardır ve (0,4n + 6) ÷ (n + 6) = 0,5 olur. Buradan n = 30 çıkar: kızlar 12’den 18’e, sınıf 36’ya çıkınca oran %50 olur.",
      ask: "Neden 60 değil?",
      explanation:
        "Tam olmadı: 6 kız gelince sınıf da büyür. 30 öğrencinin 12’si kız; 6 kız gelince 36 öğrencinin 18’i kız olur, yani %50.",
      options: [
        { text: "24" },
        { result: "right", text: "30" },
        { text: "36" },
        { text: "40" },
        { result: "wrong", text: "60" },
      ],
      question:
        "Bir sınıftaki öğrencilerin %40’ı kızdır. Sınıfa 6 kız öğrenci daha katılınca kızların oranı %50 oluyor. Başlangıçta sınıfta kaç öğrenci vardır?",
      subject: basicMath,
    },
    // The TYT, its first session.
    sittings: ["2026-06-20"],
    subjects: [turkish, basicMath, math, physics],
    timeZone: "Europe/Istanbul",
    today: [
      mainIdea,
      { id: "problems", minutes: 6, subject: basicMath, title: "Yüzde ve kâr-zarar problemleri" },
      { id: "newton", minutes: 6, subject: physics, title: "Newton’un hareket yasaları" },
    ],
    tomorrow: {
      lessons: [
        {
          id: "derivative",
          minutes: 6,
          subject: math,
          title: "Türev: artan ve azalan fonksiyonlar",
        },
        { id: "ratio", minutes: 5, subject: basicMath, title: "Oran ve orantı" },
      ],
      review: { ...mainIdea, id: "review", minutes: 4, title: "Tekrar: paragrafta ana düşünce" },
    },
  },
  job: {
    formulas: ["=TOPLA(B2:B9)", "=TOPLAM(B2:B9)", "=TOPLA(B2;B9)"],
    regions: [
      { amount: 42_180, id: "marmara", name: "Marmara" },
      { amount: 37_920, id: "central", name: "İç Anadolu" },
      { amount: 29_400, id: "aegean", name: "Ege" },
    ],
    result: "Çalıştı. En çok satış Marmara’da.",
    sql: { orders: "siparisler", region: "bolge", sales: "satis" },
  },
  move: "london",
};

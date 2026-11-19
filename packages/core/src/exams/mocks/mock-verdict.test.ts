import { describe, expect, it } from "vitest";
import { type MockResult } from "./mock-contract";
import { getMockVerdict } from "./mock-verdict";

type Area = MockResult["areas"][number];

const LANGUAGES = "Linguagens, Códigos e suas Tecnologias";
const ENGLISH = "Língua Inglesa";

const ENEM_SUBJECTS = [
  { name: LANGUAGES, shortName: "Linguagens" },
  { name: ENGLISH, partOf: LANGUAGES, shortName: "Inglês" },
  { name: "Ciências Humanas e suas Tecnologias", shortName: "Ciências Humanas" },
  { name: "Ciências da Natureza e suas Tecnologias", shortName: "Ciências da Natureza" },
  { name: "Matemática e suas Tecnologias", shortName: "Matemática" },
];

function ranged({
  correct,
  high,
  low,
  name,
  total,
}: {
  correct: number;
  high: number;
  low: number;
  name: string;
  total: number;
}): Area {
  return {
    correct,
    name,
    part: null,
    points: { asked: total, earned: correct },
    score: { high, low, score: (low + high) / 2 },
    secondsPerQuestion: 120,
    targetSecondsPerQuestion: null,
    total,
  };
}

function counted({
  blank = 0,
  name,
  penalty = 0,
  right,
  wrong,
}: {
  blank?: number;
  name: string;
  penalty?: number;
  right: number;
  wrong: number;
}): Area {
  const total = right + wrong + blank;

  return {
    correct: right,
    name,
    part: null,
    points: { asked: total, earned: right - wrong * penalty },
    score: null,
    secondsPerQuestion: 120,
    targetSecondsPerQuestion: null,
    total,
  };
}

const NOTHING = { strongest: null, weakest: null };

describe(getMockVerdict, () => {
  it("names nothing when the subjects' ranges overlap, however far apart their middles are", () => {
    const areas = [
      ranged({ correct: 12, high: 550, low: 420, name: "Linguagens", total: 20 }),
      ranged({ correct: 3, high: 690, low: 390, name: ENGLISH, total: 5 }),
      ranged({ correct: 15, high: 570, low: 430, name: "Ciências Humanas", total: 18 }),
    ];

    expect(getMockVerdict({ result: { areas }, subjects: ENEM_SUBJECTS })).toStrictEqual(NOTHING);
  });

  it("names nothing when two subjects' ranges overlap", () => {
    const areas = [
      ranged({ correct: 25, high: 620, low: 500, name: "Ciências Humanas", total: 45 }),
      ranged({ correct: 30, high: 680, low: 560, name: "Ciências da Natureza", total: 45 }),
    ];

    expect(getMockVerdict({ result: { areas }, subjects: ENEM_SUBJECTS })).toStrictEqual(NOTHING);
  });

  it("names the strongest and the weakest when their ranges stand clear of every other one", () => {
    const areas = [
      ranged({ correct: 12, high: 450, low: 380, name: "Matemática", total: 45 }),
      ranged({ correct: 38, high: 680, low: 600, name: "Ciências Humanas", total: 45 }),
      ranged({ correct: 25, high: 560, low: 470, name: "Ciências da Natureza", total: 45 }),
    ];

    expect(getMockVerdict({ result: { areas }, subjects: ENEM_SUBJECTS })).toStrictEqual({
      strongest: "Ciências Humanas",
      weakest: "Matemática",
    });
  });

  it("names only the strongest when no subject stands clear below every other one", () => {
    const areas = [
      ranged({ correct: 38, high: 680, low: 600, name: "Ciências Humanas", total: 45 }),
      ranged({ correct: 20, high: 540, low: 450, name: "Matemática", total: 45 }),
      ranged({ correct: 22, high: 560, low: 470, name: "Ciências da Natureza", total: 45 }),
    ];

    expect(getMockVerdict({ result: { areas }, subjects: ENEM_SUBJECTS })).toStrictEqual({
      strongest: "Ciências Humanas",
      weakest: null,
    });
  });

  it("names only the weakest when no subject stands clear above every other one", () => {
    const areas = [
      ranged({ correct: 38, high: 680, low: 600, name: "Ciências Humanas", total: 45 }),
      ranged({ correct: 36, high: 660, low: 580, name: "Ciências da Natureza", total: 45 }),
      ranged({ correct: 12, high: 450, low: 380, name: "Matemática", total: 45 }),
    ];

    expect(getMockVerdict({ result: { areas }, subjects: ENEM_SUBJECTS })).toStrictEqual({
      strongest: null,
      weakest: "Matemática",
    });
  });

  it("never compares a part with the subject it belongs to", () => {
    const areas = [
      ranged({ correct: 5, high: 800, low: 700, name: ENGLISH, total: 5 }),
      ranged({ correct: 10, high: 450, low: 380, name: "Linguagens", total: 40 }),
      ranged({ correct: 30, high: 560, low: 500, name: "Ciências Humanas", total: 45 }),
    ];

    expect(getMockVerdict({ result: { areas }, subjects: ENEM_SUBJECTS })).toStrictEqual(NOTHING);
  });

  it("compares a part with the subjects it doesn't belong to", () => {
    const areas = [
      ranged({ correct: 5, high: 800, low: 700, name: ENGLISH, total: 5 }),
      ranged({ correct: 30, high: 600, low: 500, name: "Linguagens", total: 40 }),
      ranged({ correct: 30, high: 560, low: 480, name: "Ciências Humanas", total: 45 }),
    ];

    expect(getMockVerdict({ result: { areas }, subjects: ENEM_SUBJECTS })).toStrictEqual({
      strongest: ENGLISH,
      weakest: null,
    });
  });

  it("names nothing in a mock of one subject, alone or with its parts", () => {
    const alone = [ranged({ correct: 20, high: 600, low: 500, name: "Matemática", total: 45 })];

    const withPart = [
      ranged({ correct: 30, high: 600, low: 520, name: "Linguagens", total: 40 }),
      ranged({ correct: 1, high: 450, low: 300, name: ENGLISH, total: 5 }),
    ];

    expect(getMockVerdict({ result: { areas: alone }, subjects: ENEM_SUBJECTS })).toStrictEqual(
      NOTHING,
    );

    expect(getMockVerdict({ result: { areas: withPart }, subjects: ENEM_SUBJECTS })).toStrictEqual(
      NOTHING,
    );
  });

  it("names subjects by right answers only when so many right in one and so few in the other can't be chance", () => {
    const apart = [
      counted({ name: "Direito Civil", right: 18, wrong: 2 }),
      counted({ name: "Direito Penal", right: 6, wrong: 14 }),
    ];

    const close = [
      counted({ name: "Direito Civil", right: 7, wrong: 3 }),
      counted({ name: "Direito Penal", right: 5, wrong: 5 }),
    ];

    expect(getMockVerdict({ result: { areas: apart }, subjects: [] })).toStrictEqual({
      strongest: "Direito Civil",
      weakest: "Direito Penal",
    });

    expect(getMockVerdict({ result: { areas: close }, subjects: [] })).toStrictEqual(NOTHING);
  });

  it("under a net score, names nothing when the subject with more right answers lost more to wrong ones", () => {
    const areas = [
      counted({ name: "Direito Constitucional", penalty: 1, right: 65, wrong: 35 }),
      counted({ blank: 55, name: "Direito Administrativo", penalty: 1, right: 45, wrong: 0 }),
    ];

    expect(getMockVerdict({ result: { areas }, subjects: [] })).toStrictEqual(NOTHING);
  });

  it("under a net score, names subjects when their right answers and their net agree", () => {
    const areas = [
      counted({ blank: 10, name: "Direito Constitucional", penalty: 1, right: 80, wrong: 10 }),
      counted({ blank: 30, name: "Direito Administrativo", penalty: 1, right: 40, wrong: 30 }),
    ];

    expect(getMockVerdict({ result: { areas }, subjects: [] })).toStrictEqual({
      strongest: "Direito Constitucional",
      weakest: "Direito Administrativo",
    });
  });

  it("names nothing when no answer was right, whatever each estimate says", () => {
    const areas = [
      ranged({ correct: 0, high: 380, low: 300, name: "Linguagens", total: 45 }),
      ranged({ correct: 0, high: 520, low: 440, name: "Ciências Humanas", total: 45 }),
    ];

    expect(getMockVerdict({ result: { areas }, subjects: ENEM_SUBJECTS })).toStrictEqual(NOTHING);
  });

  it("names nothing when every answer was right, whatever each estimate says", () => {
    const areas = [
      ranged({ correct: 45, high: 900, low: 820, name: "Linguagens", total: 45 }),
      ranged({ correct: 45, high: 780, low: 700, name: "Ciências Humanas", total: 45 }),
    ];

    expect(getMockVerdict({ result: { areas }, subjects: ENEM_SUBJECTS })).toStrictEqual(NOTHING);
  });
});

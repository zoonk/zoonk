import { describe, expect, it } from "vitest";
import {
  dropEquivalentOptions,
  findAnswerKeyProblems,
  findEquivalentOptions,
  findOptionDataProblems,
} from "./option-checks";

describe(findEquivalentOptions, () => {
  it("passes options a learner can tell apart", () => {
    expect(
      findEquivalentOptions({
        language: "en",
        texts: ["R$ 15", "R$ 20", "R$ 20,00 each", "0,5 L"],
      }),
    ).toStrictEqual([]);

    expect(
      findEquivalentOptions({ language: "pt", texts: ["600.000 L", "600 L", "1.200 m", "1,2 m"] }),
    ).toStrictEqual([]);
  });

  it("finds options that differ only in case, accents, marks or punctuation", () => {
    expect(
      findEquivalentOptions({ language: "pt", texts: ["A célula", "a **celula**.", "O núcleo"] }),
    ).toStrictEqual([expect.stringContaining('"A célula" and "a **celula**."')]);
  });

  it("finds the same number written two ways", () => {
    expect(
      findEquivalentOptions({ language: "pt", texts: ["R$ 15", "R$ 15,00", "0,5", "0.50", "15%"] }),
    ).toStrictEqual([
      expect.stringContaining('"R$ 15" and "R$ 15,00"'),
      expect.stringContaining('"0,5" and "0.50"'),
    ]);
  });
});

describe(dropEquivalentOptions, () => {
  it("drops an option that says what another says, keeping the right one of two twins", () => {
    const options = [
      { isCorrect: false, text: "R$ 15" },
      { isCorrect: false, text: "R$ 20" },
      { isCorrect: true, text: "R$ 15,00" },
      { isCorrect: false, text: "r$ 20." },
      { isCorrect: false, text: "R$ 30" },
    ];

    expect(dropEquivalentOptions({ language: "pt", options })).toStrictEqual([
      { isCorrect: true, text: "R$ 15,00" },
      { isCorrect: false, text: "R$ 20" },
      { isCorrect: false, text: "R$ 30" },
    ]);
  });

  it("keeps options a learner can tell apart as they were", () => {
    const options = [
      { isCorrect: true, text: "600.000 L" },
      { isCorrect: false, text: "600 L" },
    ];

    expect(dropEquivalentOptions({ language: "pt", options })).toStrictEqual(options);
  });
});

describe(findOptionDataProblems, () => {
  const sensors = "| Sensor | mm |\n|---|---:|\n| A | 49,8 |\n| B | 50,1 |\n| C | 50,0 |";

  it("passes options that name what the data lists", () => {
    expect(findOptionDataProblems({ data: [sensors], options: ["A", "B", "C"] })).toStrictEqual([]);

    expect(
      findOptionDataProblems({
        data: ["| Fio | Resistência |\n|---|---:|\n| C | 3 Ω |\n| D | 6 Ω |"],
        options: ["D, porque dissipa mais.", "Os dois igualmente.", "C, porque conduz melhor."],
      }),
    ).toStrictEqual([]);
  });

  it("finds labelled data the options leave out, as sensors A to E against options A to D", () => {
    const five = `${sensors}\n| D | 49,9 |\n| E | 50,2 |`;

    expect(
      findOptionDataProblems({ data: [five], options: ["Sensor A", "Sensor B", "C", "D"] }),
    ).toStrictEqual([expect.stringContaining("E")]);
  });

  it("finds an option that names something the data doesn't list", () => {
    expect(findOptionDataProblems({ data: [sensors], options: ["A", "B", "D"] })).toStrictEqual([
      expect.stringContaining('"D"'),
      expect.stringContaining("C can't be picked"),
    ]);

    expect(
      findOptionDataProblems({
        data: ["I. A lei vale para todos.\nII. A lei não retroage.\nIII. A lei pode ser revogada."],
        options: ["Apenas I.", "Apenas I e II.", "I, II e IV."],
      }),
    ).toStrictEqual([expect.stringContaining("IV")]);
  });

  it("ignores options that are words, not labels", () => {
    expect(
      findOptionDataProblems({ data: [sensors], options: ["E a mais precisa", "A mais exata"] }),
    ).toStrictEqual([]);
  });
});

describe(findAnswerKeyProblems, () => {
  it("passes a sample answer that gives an accepted answer", () => {
    expect(
      findAnswerKeyProblems({
        acceptedAnswers: ["11 °C", "11 graus"],
        sampleAnswer: "A temperatura subiu 11 °C.",
      }),
    ).toStrictEqual([]);

    expect(
      findAnswerKeyProblems({
        acceptedAnswers: ["3 × 10^8", "3e8"],
        sampleAnswer: "$3 \\times 10^8$ m/s",
      }),
    ).toStrictEqual([]);

    expect(
      findAnswerKeyProblems({ acceptedAnswers: [], sampleAnswer: "Qualquer coisa." }),
    ).toStrictEqual([]);
  });

  it("finds a sample answer that contradicts the accepted answers", () => {
    expect(
      findAnswerKeyProblems({ acceptedAnswers: ["8", "oito"], sampleAnswer: "São 7 dias." }),
    ).toStrictEqual([expect.stringContaining("8")]);
  });
});

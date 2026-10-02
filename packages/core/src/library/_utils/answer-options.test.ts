import { describe, expect, it } from "vitest";
import { shuffleAnswerOptions, stripOptionLabels } from "./answer-options";

function optionsOf(...texts: string[]) {
  return texts.map((text, index) => ({ isCorrect: index === 0, text }));
}

function textsOf(options: { text: string }[]) {
  return options.map((option) => option.text);
}

describe(stripOptionLabels, () => {
  it("drops the letters a writer printed before shuffled options", () => {
    const options = optionsOf(
      "D) A perda da função econômica da cidade.",
      "A) A separação entre moradia e trabalho.",
      "C) A distribuição equilibrada dos empregos.",
      "E) A concentração das moradias no centro.",
      "B) A substituição dos deslocamentos diários.",
    );

    expect(textsOf(stripOptionLabels(options))).toStrictEqual([
      "A perda da função econômica da cidade.",
      "A separação entre moradia e trabalho.",
      "A distribuição equilibrada dos empregos.",
      "A concentração das moradias no centro.",
      "A substituição dos deslocamentos diários.",
    ]);

    expect(stripOptionLabels(options).map((option) => option.isCorrect)).toStrictEqual(
      options.map((option) => option.isCorrect),
    );
  });

  it("reads letters in parentheses, with a period or in lowercase", () => {
    expect(textsOf(stripOptionLabels(optionsOf("(B) two", "(A) one")))).toStrictEqual([
      "two",
      "one",
    ]);

    expect(textsOf(stripOptionLabels(optionsOf("b. two", "a. one", "c. three")))).toStrictEqual([
      "two",
      "one",
      "three",
    ]);
  });

  it("keeps options that only start like a label", () => {
    const species = optionsOf("C. elegans", "E. coli", "S. cerevisiae", "D. melanogaster");
    const oneLabel = optionsOf("A) and B) are both right", "Only A", "Only B", "Neither");
    const gap = optionsOf("A) one", "B) two", "D) four");
    const mixed = optionsOf("A) one", "B. two", "C) three");
    const cases = optionsOf("A) one", "b) two", "C) three");

    for (const options of [species, oneLabel, gap, mixed, cases]) {
      expect(stripOptionLabels(options)).toStrictEqual(options);
    }
  });

  it("leaves options without letters as they are", () => {
    const options = optionsOf("Cronograma II", "Cronograma III", "Cronograma I");
    expect(stripOptionLabels(options)).toStrictEqual(options);
  });
});

function writtenOptions(question: number) {
  return ["right", "wrong 1", "wrong 2", "wrong 3"].map((text, index) => ({
    isCorrect: index === 0,
    text: `${text} for question ${question}`,
  }));
}

describe(shuffleAnswerOptions, () => {
  it("keeps every option and shuffles the same options the same way", () => {
    const options = writtenOptions(1);
    const shuffled = shuffleAnswerOptions(options);

    expect(shuffled).toHaveLength(options.length);
    expect(shuffled).toStrictEqual(expect.arrayContaining(options));
    expect(shuffleAnswerOptions(options)).toStrictEqual(shuffled);
  });

  it("moves a right answer written first to other positions across questions", () => {
    const positions = new Set(
      Array.from({ length: 20 }, (_, question) =>
        shuffleAnswerOptions(writtenOptions(question)).findIndex((option) => option.isCorrect),
      ),
    );

    expect(positions.size).toBeGreaterThan(2);
  });
});

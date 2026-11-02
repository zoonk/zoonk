import { describe, expect, it } from "vitest";
import {
  findOptionPositionReferences,
  shuffleAnswerOptions,
  stripOptionLabels,
} from "./answer-options";

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

describe(findOptionPositionReferences, () => {
  it.each([
    "Você compara as razões: o primeiro tipo tem 0,6 kg/L e o segundo, 0,75 kg/L. Com o segundo tipo, 80 L comportam 60 kg.",
    "El primer tipo tiene 0,6 kg/L y el segundo, 0,75 kg/L.",
    "Le premier type contient 0,6 kg/L et le deuxième, 0,75 kg/L.",
    "Der erste Typ enthält 0,6 kg/L und der zweite, 0,75 kg/L.",
  ])("keeps conjunctions introducing content ordinals: %s", (reason) => {
    expect(findOptionPositionReferences(reason)).toStrictEqual([]);
  });

  it.each([
    "É o segundo.",
    "A resposta e\u0301 a u\u0301ltima.",
    "La respuesta es el segundo.",
    "La respuesta es la última.",
    "La respuesta sería la segunda.",
    "La respuesta será la segunda.",
    "La réponse est le deuxième.",
    "Die Antwort ist der zweite.",
  ])("still finds a position named with a verb: %s", (reason) => {
    expect(findOptionPositionReferences(reason)).toHaveLength(1);
  });

  it.each([
    "This is the second law of thermodynamics.",
    "Esta é uma equação de segundo grau.",
    "O conflito foi a segunda guerra mundial.",
    "Esta es la segunda ley de la termodinámica.",
    "C'est le deuxième principe de la thermodynamique.",
    "Das ist der zweite Hauptsatz der Thermodynamik.",
    "José o segundo, chamado assim por seu pai, chegou.",
  ])("keeps ordinals and verb-like word endings in content: %s", (reason) => {
    expect(findOptionPositionReferences(reason)).toStrictEqual([]);
  });

  it("finds feedback that points at an option by its place, which shuffling changes", () => {
    expect(findOptionPositionReferences("A anotação segura é a segunda.")).toStrictEqual([
      "é a segunda",
    ]);

    expect(findOptionPositionReferences("A primeira opção ignora o prazo.")).toStrictEqual([
      "primeira opcao",
    ]);

    expect(findOptionPositionReferences("Por isso a alternativa B está errada.")).toStrictEqual([
      "alternativa B",
    ]);

    expect(findOptionPositionReferences("The right one is the third.")).toStrictEqual([
      "is the third",
    ]);

    expect(findOptionPositionReferences("Option C forgets the fee.")).toStrictEqual(["Option C"]);

    expect(findOptionPositionReferences("La respuesta correcta es la última.")).toStrictEqual([
      "es la última",
    ]);
  });

  it("leaves ordinals that are about the content alone", () => {
    expect(
      findOptionPositionReferences(
        "A primeira lei de Newton vale aqui, e a segunda etapa do processo também.",
      ),
    ).toStrictEqual([]);

    expect(findOptionPositionReferences("It is an option a lot of teams choose.")).toStrictEqual(
      [],
    );

    expect(
      findOptionPositionReferences("Recife é a segunda maior cidade do Nordeste."),
    ).toStrictEqual([]);
  });
});

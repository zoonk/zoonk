import { type PastQuestion } from "@zoonk/ai/tasks/items/past-questions";
import { describe, expect, it } from "vitest";
import { checkPastQuestion } from "./past-question-checks";

const PAPER = `QUESTÃO 136
Uma loja anunciou: “Tudo com 20% de desconto”. Depois, sobre o preço já com descon-
to, deu mais 10% para pagamento à vista.
Disponível em: www.exemplo.gov.br. Acesso em: 5 maio 2023 (adaptado).
O desconto total sobre o preço original foi de
A 28%.
B 30%.
C 18%.
D 32%.
E 25%.`;

const PRINTED_ITEM = {
  context:
    'Uma loja anunciou: "Tudo com 20% de desconto". Depois, sobre o preço já com desconto, deu mais 10% para pagamento à vista. Disponível em: www.exemplo.gov.br. Acesso em: 5 maio 2023 (adaptado).',
  difficulty: "medium" as const,
  fixedOrder: false,
  format: "multipleChoice" as const,
  image: null,
  options: ["28%.", "30%.", "18%.", "32%.", "25%."].map((text, index) => ({
    isCorrect: index === 0,
    misconception: index === 0 ? null : "Adds the discounts",
    reason: "Reason.",
    text,
  })),
  question: "O desconto total sobre o preço original foi de",
  visual: null,
};

const TARGET = { format: "multipleChoice" as const, language: "pt", optionCount: 5, skillCount: 3 };

function question(overrides: Partial<PastQuestion> = {}): PastQuestion {
  return {
    citation: "Enem 2023, 2º dia, questão 136",
    item: PRINTED_ITEM,
    number: "136",
    skill: 1,
    ...overrides,
  };
}

function tableQuestion(context: string): PastQuestion {
  const item = {
    ...PRINTED_ITEM,
    context,
    options: [
      "Andrea's mean is higher.",
      "Joe's mean is higher.",
      "Both means are equal.",
      "Neither has a mean.",
    ].map((text, index) => ({ ...PRINTED_ITEM.options[index]!, text })),
    question: "Which statement about their test scores is correct?",
  };

  return question({ citation: "Algebra I, June 2025, question 4", item, number: "4" });
}

describe(checkPastQuestion, () => {
  it("accepts a question copied as printed, whatever the line breaks, hyphens and quote marks", () => {
    expect(
      checkPastQuestion({ paperText: PAPER, question: question(), target: TARGET }).problems,
    ).toStrictEqual([]);
  });

  it("refuses a reworded part, naming which one", () => {
    const item = { ...PRINTED_ITEM, question: "Qual foi o desconto total sobre o preço original?" };

    expect(
      checkPastQuestion({ paperText: PAPER, question: question({ item }), target: TARGET })
        .problems,
    ).toStrictEqual(["The command isn't in the paper as printed."]);
  });

  it("needs a citation with the question's number and one of the skills", () => {
    expect(
      checkPastQuestion({
        paperText: PAPER,
        question: question({ citation: "Enem 2023", skill: 4 }),
        target: TARGET,
      }).problems,
    ).toStrictEqual([
      "The citation doesn't name the question's number.",
      "The question isn't tagged with one of the skills.",
    ]);
  });

  it("leaves out a question that depends on a figure, which can't be copied", () => {
    const item = { ...PRINTED_ITEM, image: { alt: "Um gráfico de pizza.", prompt: "Pizza" } };

    expect(
      checkPastQuestion({ paperText: PAPER, question: question({ item }), target: TARGET })
        .problems,
    ).toStrictEqual(["The question depends on a figure, which can't be copied."]);
  });

  it("checks a true or false statement and its support text", () => {
    const statement: PastQuestion = {
      citation: "Cebraspe, item 42",
      item: {
        context: null,
        difficulty: "easy",
        format: "trueFalse",
        image: null,
        isTrue: false,
        misconception: "Swaps the rule",
        reason: "Reason.",
        statement: "A loja deu 30% de desconto no total.",
        visual: null,
      },
      number: "42",
      skill: 1,
    };

    expect(
      checkPastQuestion({
        paperText: PAPER,
        question: statement,
        target: { ...TARGET, format: "trueFalse", optionCount: null, skillCount: 1 },
      }).problems,
    ).toStrictEqual(["The statement isn't in the paper as printed."]);
  });

  describe("a paper whose text lost the spaces between its words", () => {
    const GLUED_PAPER = `QUESTÃO 143
Adireçãodafábricarealizouumapesquisaeconstatouquealistadeesperaparaopróximoanoteráamesma quantidadedenomesdalistadeesperadesteano.
Onúmeromínimodesalasquedeverãoserconstruídasé
A 10.
B 11.
C 13.
D 30.
E 33.
QUESTÃO 144
Ogerentedeumalojaanunciouumapromoçãoemquecadaclientequerealizar uma compra ganha um voucher.
Paraisso,resolveualteraraquantidadede bolinhas brancas na urnaB.`;

    const gluedItem = {
      ...PRINTED_ITEM,
      context:
        "Adireçãodafábricarealizouumapesquisaeconstatouquealistadeesperaparaopróximoanoteráamesma quantidadedenomesdalistadeesperadesteano.",
      options: ["10.", "11.", "13.", "30.", "33."].map((text, index) => ({
        ...PRINTED_ITEM.options[index]!,
        text,
      })),
      question: "Onúmeromínimodesalasquedeverãoserconstruídasé",
    };

    const glued = question({ citation: "Enem 2023, questão 143", item: gluedItem, number: "143" });

    it("refuses a copy that keeps the words run together", () => {
      expect(
        checkPastQuestion({ paperText: GLUED_PAPER, question: glued, target: TARGET }).problems,
      ).toStrictEqual([
        'The support text runs words together as the paper\'s text does: "Adireçãodafábricarealizouumapesquisaeconstatouquealistadeesperaparaopróximoanoteráamesma".',
        'The support text runs words together as the paper\'s text does: "quantidadedenomesdalistadeesperadesteano".',
        'The command runs words together as the paper\'s text does: "Onúmeromínimodesalasquedeverãoserconstruídasé".',
      ]);
    });

    it("accepts the copy with the printed page's spaces put back", () => {
      const item = {
        ...gluedItem,
        context:
          "A direção da fábrica realizou uma pesquisa e constatou que a lista de espera para o próximo ano terá a mesma quantidade de nomes da lista de espera deste ano.",
        question: "O número mínimo de salas que deverão ser construídas é",
      };

      expect(
        checkPastQuestion({ paperText: GLUED_PAPER, question: { ...glued, item }, target: TARGET })
          .problems,
      ).toStrictEqual([]);
    });
  });

  it("keeps a long word of a paper that kept its spaces", () => {
    const paper = `Lesen Sie den Text und beantworten Sie die Fragen. Für jede Frage gibt es nur eine richtige Antwort. Sie haben für diesen Teil der Prüfung neunzig Minuten Zeit. Schreiben Sie Ihre Antworten am Ende auf den Antwortbogen. Benutzen Sie dafür einen schwarzen oder blauen Stift. Wörterbücher und Telefone sind während der ganzen Prüfung nicht erlaubt.
QUESTÃO 136
Das Bundesausbildungsförderungsgesetz regelt die Förderung.
Was regelt es?
A Die Förderung.
B Die Miete.
C Die Steuer.
D Die Rente.
E Die Schule.`;

    const item = {
      ...PRINTED_ITEM,
      context: "Das Bundesausbildungsförderungsgesetz regelt die Förderung.",
      options: ["Die Förderung.", "Die Miete.", "Die Steuer.", "Die Rente.", "Die Schule."].map(
        (text, index) => ({ ...PRINTED_ITEM.options[index]!, text }),
      ),
      question: "Was regelt es?",
    };

    expect(
      checkPastQuestion({
        paperText: paper,
        question: question({ item }),
        target: { ...TARGET, language: "de" },
      }).problems,
    ).toStrictEqual([]);
  });

  it("doesn't take a script without spaces for words run together", () => {
    const paper = `問題 136
次の文章を読んで、最も適切な答えを一つ選びなさい。日本の首都はどこですか。
A 東京。
B 大阪。
C 京都。
D 名古屋。
E 札幌。`;

    const item = {
      ...PRINTED_ITEM,
      context: "次の文章を読んで、最も適切な答えを一つ選びなさい。",
      options: ["東京。", "大阪。", "京都。", "名古屋。", "札幌。"].map((text, index) => ({
        ...PRINTED_ITEM.options[index]!,
        text,
      })),
      question: "日本の首都はどこですか。",
    };

    expect(
      checkPastQuestion({
        paperText: paper,
        question: question({ citation: "問題 136", item }),
        target: { ...TARGET, language: "ja" },
      }).problems,
    ).toStrictEqual([]);
  });

  it("refuses a support text that leaves out an instruction a few questions repeat", () => {
    const rule = "Ignore the return trip and every journey made before the passenger boarded.";

    const paper = [41, 42, 43]
      .map(
        (number) =>
          `${number} A bus travels 120 km.\n${rule}\nIt takes 2 hours.\nWhat is its speed?`,
      )
      .join("\n");

    const item = {
      ...PRINTED_ITEM,
      context: "A bus travels 120 km.\nIt takes 2 hours.",
      question: "What is its speed?",
    };

    expect(
      checkPastQuestion({
        paperText: paper,
        question: question({ citation: "Question 41", item, number: "41" }),
        target: { ...TARGET, language: "en" },
      }).problems.filter((problem) => problem.startsWith("The support text")),
    ).toStrictEqual(["The support text isn't in the paper as printed."]);
  });

  it("refuses a symbol slipped into an option, though a figure's labels repeat it", () => {
    const figure = [1, 2, 3, 4, 5].map((figureNumber) => `Figura ${figureNumber}\nα`).join("\n");

    const item = {
      ...PRINTED_ITEM,
      options: PRINTED_ITEM.options.map((option, index) =>
        index === 0 ? { ...option, text: "28%.\nα" } : option,
      ),
    };

    expect(
      checkPastQuestion({
        paperText: `${figure}\n${PAPER}`,
        question: question({ item }),
        target: TARGET,
      }).problems,
    ).toStrictEqual(["Option 1 isn't in the paper as printed."]);
  });

  describe("a table the paper's text gives as rows of pipes", () => {
    const TABLE_PAPER = `1 Which expression is equivalent to 2(x + 3)?
Use this space for computations.
2 Which point lies on the line y = 2x?
Use this space for computations.
3 Which scenario represents an exponential relationship?
Use this space for computations.
4 The geometry test scores for Andrea and Joe are shown in the table below.
Use this space for computations.
| Andrea | Joe |
| 82 | 91 |
| 87 | 78 |
Which statement about their test scores is correct?
(1) Andrea's mean is higher.
(2) Joe's mean is higher.
(3) Both means are equal.
(4) Neither has a mean.
5 Which polynomial has a degree of 3?
Use this space for computations.`;

    const target = { ...TARGET, language: "en", optionCount: 4 };

    it("accepts the rows with the line that makes them a table, without the page's notes", () => {
      const context = `The geometry test scores for Andrea and Joe are shown in the table below.
| Andrea | Joe |
| --- | --- |
| 82 | 91 |
| 87 | 78 |`;

      expect(
        checkPastQuestion({ paperText: TABLE_PAPER, question: tableQuestion(context), target })
          .problems,
      ).toStrictEqual([]);
    });

    it("refuses a changed value", () => {
      const context = `The geometry test scores for Andrea and Joe are shown in the table below.
| Andrea | Joe |
| --- | --- |
| 82 | 91 |
| 87 | 79 |`;

      expect(
        checkPastQuestion({ paperText: TABLE_PAPER, question: tableQuestion(context), target })
          .problems,
      ).toStrictEqual(["The support text isn't in the paper as printed."]);
    });

    it("accepts a copy that keeps the page's note", () => {
      const context = `The geometry test scores for Andrea and Joe are shown in the table below.
Use this space for computations.
| Andrea | Joe |
| --- | --- |
| 82 | 91 |
| 87 | 78 |`;

      expect(
        checkPastQuestion({ paperText: TABLE_PAPER, question: tableQuestion(context), target })
          .problems,
      ).toStrictEqual([]);
    });

    it("refuses a table with a row left out", () => {
      const context = `The geometry test scores for Andrea and Joe are shown in the table below.
| Andrea | Joe |
| --- | --- |
| 87 | 78 |`;

      expect(
        checkPastQuestion({ paperText: TABLE_PAPER, question: tableQuestion(context), target })
          .problems,
      ).toStrictEqual(["The support text isn't in the paper as printed."]);
    });

    it("refuses the paper's parts put in another order", () => {
      const context = `| Andrea | Joe |
| --- | --- |
| 82 | 91 |
| 87 | 78 |
The geometry test scores for Andrea and Joe are shown in the table below.`;

      expect(
        checkPastQuestion({ paperText: TABLE_PAPER, question: tableQuestion(context), target })
          .problems,
      ).toStrictEqual(["The support text isn't in the paper as printed."]);
    });

    it("refuses text pieced together from far apart in the paper", () => {
      const context = `The geometry test scores for Andrea and Joe are shown in the table below.
| Andrea | Joe |
| --- | --- |
| 82 | 91 |
| 87 | 78 |
Which polynomial has a degree of 3?`;

      expect(
        checkPastQuestion({ paperText: TABLE_PAPER, question: tableQuestion(context), target })
          .problems,
      ).toStrictEqual(["The support text isn't in the paper as printed."]);
    });
  });
});

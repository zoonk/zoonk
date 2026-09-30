import { type PastQuestion } from "@zoonk/ai/tasks/v2/items/past-questions";
import { describe, expect, it } from "vitest";
import { checkPastQuestion } from "./past-question-checks";

/** The paper's text as a PDF extractor writes it: broken lines, a hyphenated word and curly quotes. */
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
  format: "multipleChoice" as const,
  options: ["28%.", "30%.", "18%.", "32%.", "25%."].map((text, index) => ({
    isCorrect: index === 0,
    misconception: index === 0 ? null : "Adds the discounts",
    reason: "Reason.",
    text,
  })),
  question: "O desconto total sobre o preço original foi de",
};

function question(overrides: Partial<PastQuestion> = {}): PastQuestion {
  return {
    citation: "Enem 2023, 2º dia, questão 136",
    item: PRINTED_ITEM,
    number: "136",
    skill: 1,
    ...overrides,
  };
}

describe(checkPastQuestion, () => {
  it("accepts a question copied as printed, whatever the line breaks, hyphens and quote marks", () => {
    expect(
      checkPastQuestion({ paperText: PAPER, question: question(), skillCount: 3 }),
    ).toStrictEqual([]);
  });

  it("refuses a reworded part, naming which one", () => {
    const item = { ...PRINTED_ITEM, question: "Qual foi o desconto total sobre o preço original?" };

    expect(
      checkPastQuestion({ paperText: PAPER, question: question({ item }), skillCount: 3 }),
    ).toStrictEqual(["The command isn't in the paper as printed."]);
  });

  it("needs a citation with the question's number and one of the skills", () => {
    expect(
      checkPastQuestion({
        paperText: PAPER,
        question: question({ citation: "Enem 2023", skill: 4 }),
        skillCount: 3,
      }),
    ).toStrictEqual([
      "The citation doesn't name the question's number.",
      "The question isn't tagged with one of the skills.",
    ]);
  });

  it("checks a true or false statement and its support text", () => {
    const statement: PastQuestion = {
      citation: "Cebraspe, item 42",
      item: {
        context: null,
        difficulty: "easy",
        format: "trueFalse",
        isTrue: false,
        misconception: "Swaps the rule",
        reason: "Reason.",
        statement: "A loja deu 30% de desconto no total.",
      },
      number: "42",
      skill: 1,
    };

    expect(
      checkPastQuestion({ paperText: PAPER, question: statement, skillCount: 1 }),
    ).toStrictEqual(["The statement isn't in the paper as printed."]);
  });
});

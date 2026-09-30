import { type TestCase } from "@/lib/types";
import { type GenerateExampleLineParams } from "@zoonk/ai/tasks/v2/variants/example-line";

type ExampleLineInput = Omit<
  GenerateExampleLineParams,
  "analytics" | "model" | "reasoning" | "useFallback"
>;

const SHARED_EXPECTATIONS = `
  - The output is \`line\`: one sentence, or null when nothing the learner shared fits
  - Don't evaluate JSON formatting
`;

export const TEST_CASES: TestCase<never, ExampleLineInput>[] = [
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - The learner shares the rent with two friends: a line splitting a rent in reais three ways fits, with the money written the Brazilian way (R$ 1.200, R$ 400) and correct math
      - The learner never said where they live, so the line MUST NOT name a city, neighborhood or region
      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-rent-split-no-city",
    userInput: {
      facts: ["Faz faculdade à noite", "Divide o aluguel com duas amigas"],
      goal: "Organizar as finanças pessoais",
      idea: "Uma conta dividida em partes iguais.",
      language: "pt",
      screenText:
        "Dividir uma conta em partes iguais é dividir o total pelo número de pessoas. Uma conta de R$ 90 entre 3 pessoas dá R$ 30 para cada uma.",
    },
  },
  {
    expectations: `
      - MUST be in US English
      - The learner is saving for a car: a line with a percent of what they save, in dollars written the US way ($2,500), with correct math, fits
      - The learner never said where they live, so the line MUST NOT name a city or state
      ${SHARED_EXPECTATIONS}
    `,
    id: "en-car-savings-no-city",
    userInput: {
      facts: ["Works night shifts as a nurse", "Saving for a car"],
      goal: null,
      idea: "A percent of an amount the learner saves or spends.",
      language: "en",
      screenText:
        "A percent is a number out of 100. 20% of $500 is 20 out of every 100 dollars: $100.",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - The learner works at a pharmacy: a line about a discount on something sold at a pharmacy fits, with the discount computed on the original price
      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-pharmacy-discount",
    userInput: {
      facts: ["Trabalha numa farmácia em Recife", "Gosta de exemplos com números"],
      goal: "Revisar matemática básica",
      idea: "Um desconto em algo que a pessoa compra ou vende.",
      language: "pt",
      screenText:
        "Um desconto de 25% tira um quarto do preço original. Num produto de R$ 80, isso é R$ 20 a menos: você paga R$ 60.",
    },
  },
  {
    expectations: `
      - MUST be in US English
      - The learner bikes to work in Toronto: a percent change on something from their commute or city fits (a transit fare, a bike part), with correct numbers
      ${SHARED_EXPECTATIONS}
    `,
    id: "en-toronto-percent-change",
    userInput: {
      facts: ["Lives in Toronto", "Bikes to work every day"],
      goal: null,
      idea: "A price the learner pays that went up or down.",
      language: "en",
      screenText:
        "Percent change compares a change with the starting value. A ticket going from $80 to $100 changed by $20, which is 25% of $80.",
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Nothing the learner shared (studying at night, a driving test) fits photosynthesis naturally, so the right answer is null
      ${SHARED_EXPECTATIONS}
    `,
    id: "en-no-fit-null",
    userInput: {
      facts: ["Prefers to study at night"],
      goal: "Pass the driving test",
      idea: "A plant the learner sees every day.",
      language: "en",
      screenText:
        "Leaves use sunlight to turn water and carbon dioxide into sugar. The oxygen we breathe is what's left over.",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - The learner is a nurse: a dose or drip calculation fits the rule of three, and the numbers must be right (more medicine per dose in the same proportion)
      - It must not give medical advice beyond the arithmetic
      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-nurse-rule-of-three",
    userInput: {
      facts: ["É enfermeira num hospital público"],
      goal: "Passar no concurso da prefeitura",
      idea: "Uma proporção direta no trabalho da pessoa.",
      language: "pt",
      screenText:
        "Se 2 kg de farinha rendem 30 pães, 4 kg rendem 60: as duas quantidades crescem juntas, na mesma proporção. Isso é uma proporção direta.",
    },
  },
];

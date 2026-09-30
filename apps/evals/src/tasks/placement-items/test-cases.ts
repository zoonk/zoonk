import { type TestCase } from "@/lib/types";
import { type PlacementItemsParams } from "@zoonk/ai/tasks/v2/items/placement-items";
import { CEBRASPE, ENEM, SAT_MATH } from "../generate-items/test-cases";

type PlacementItemsInput = Omit<PlacementItemsParams, "model" | "useFallback" | "reasoning">;

/** What placement writes per skill: one quick question to ask it and one typed to confirm it. */
const PLACEMENT_COUNTS = { quickCount: 1, typedCount: 1 } as const;

/**
 * Each case batches three skills, one more than placement sends per call, including skills the
 * generate-items eval writes one at a time, so batched and single-skill scores can be compared.
 */
export const TEST_CASES: TestCase<unknown, PlacementItemsInput>[] = [
  {
    expectations: `Placement questions in Brazilian Portuguese for three ENEM skills, each skill with one ENEM-style multiple-choice question (short support text, a command, 5 options, distractors from typical mistakes such as adding successive percentages or misreading a table row) and one typed question asking for a short answer or explanation with checkable key points. Each question tests only its own skill, a skill's two questions use different situations, and the typed question doesn't repeat or give away the multiple-choice one's answer. Tables go in \`context\` as GFM pipe tables. Every question reads like a typical ENEM question at its level, never like a primary-school exercise.`,
    id: "pt-enem-placement-three-skills",
    userInput: {
      ...PLACEMENT_COUNTS,
      examFormat: ENEM,
      language: "pt",
      quickFormat: "multipleChoice",
      skills: [
        {
          description:
            "Calcular o efeito de aumentos e descontos percentuais aplicados um após o outro.",
          level: "intermediate",
          name: "Aumentos e descontos percentuais sucessivos",
        },
        {
          description:
            "Ler e comparar dados apresentados em tabelas para responder a perguntas sobre valores, diferenças e variações.",
          level: "beginner",
          name: "Leitura de dados em tabelas",
        },
        {
          description:
            "Calcular a energia que um aparelho doméstico consome a partir da potência e do tempo de uso, e quanto isso custa.",
          level: "intermediate",
          name: "Consumo de energia elétrica em casa",
        },
      ],
    },
  },
  {
    expectations: `Placement questions in Brazilian Portuguese for three Brazilian administrative-law skills of a Cebraspe exam. Each skill's quick question is a Cebraspe-style assertion judged Certo or Errado (true/false), never multiple choice: a false one hides one realistic trap (a swapped concept, a wrong exception, an absolute word). Each skill also has one typed question with checkable key points. Check the legal accuracy of every statement against the Constitution's article 37, Law 9.784/1999 and STF Precedent 473. Each question tests only its own skill, and the typed question doesn't give away the assertion's judgment.`,
    id: "pt-cebraspe-placement-true-false",
    userInput: {
      ...PLACEMENT_COUNTS,
      examFormat: CEBRASPE,
      language: "pt",
      quickFormat: "trueFalse",
      skills: [
        {
          description:
            "Aplicar os princípios da administração pública do art. 37 da Constituição a situações concretas.",
          level: "intermediate",
          name: "Princípios da administração pública (LIMPE)",
        },
        {
          description:
            "Distinguir quando a administração deve anular um ato administrativo e quando pode revogá-lo, e os efeitos de cada um.",
          level: "intermediate",
          name: "Anulação e revogação de atos administrativos",
        },
        {
          description:
            "Reconhecer o poder de polícia, seus atributos e limites, em situações da administração pública.",
          level: "intermediate",
          name: "Poder de polícia",
        },
      ],
    },
  },
  {
    expectations: `Placement questions in US English for three Digital SAT skills, each with one SAT-style multiple-choice question (concise context, a direct question, 4 options, distractors from real slips such as sign errors or dividing by the new value) and one typed question with checkable key points and accepted answers for short answers. The math must be right. Each question tests only its own skill, and a skill's typed question uses a different situation from its multiple-choice one.`,
    id: "en-sat-placement-three-skills",
    userInput: {
      ...PLACEMENT_COUNTS,
      examFormat: SAT_MATH,
      language: "en",
      quickFormat: "multipleChoice",
      skills: [
        {
          description:
            "Solve linear equations in one variable, including ones with parentheses and fractions.",
          level: "intermediate",
          name: "Solving linear equations in one variable",
        },
        {
          description:
            "Compute the percent increase or decrease between an original and a new value.",
          level: "intermediate",
          name: "Percent change",
        },
        {
          description:
            "Interpret the slope and y-intercept of a linear model in the context of a real situation.",
          level: "intermediate",
          name: "Interpreting linear models",
        },
      ],
    },
  },
  {
    expectations: `Placement questions in US English for three beginner biology skills without an exam: everyday, clear questions. Each skill gets one multiple-choice question with a misconception behind every wrong option and one typed question whose key points can be checked one at a time (for cellular respiration, for example: glucose is broken down, oxygen is used, energy is stored as ATP). Each question tests only its own skill.`,
    id: "en-biology-placement-no-exam",
    userInput: {
      ...PLACEMENT_COUNTS,
      language: "en",
      quickFormat: "multipleChoice",
      skills: [
        {
          description:
            "Explain how cells release energy from glucose using oxygen, and where it happens.",
          level: "beginner",
          name: "Cellular respiration",
        },
        {
          description:
            "Explain how plants use light, water and carbon dioxide to make sugar and release oxygen.",
          level: "beginner",
          name: "Photosynthesis",
        },
        {
          description:
            "Explain how temperature and pH change how fast an enzyme works, and why too much heat stops it.",
          level: "beginner",
          name: "Enzyme activity",
        },
      ],
    },
  },
];

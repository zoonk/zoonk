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
    expectations: `Questions in Brazilian Portuguese for three constitutional-law skills (one multiple-choice question and one typed question each). Each skill lists the situations its questions in the bank already use (USED_SITUATIONS): no new question may use one of those situations again with other names, places or numbers (a meeting in a public square for the right of assembly; a request for one's own records for habeas data), and a skill's two new questions differ from each other too. Check the legal accuracy against the Constitution's article 5 (XVI, LXXII, LXIX).`,
    id: "pt-constitutional-mock-avoids-used-situations",
    userInput: {
      ...PLACEMENT_COUNTS,
      language: "pt",
      quickFormat: "multipleChoice",
      skills: [
        {
          description:
            "Aplicar o direito de reunião (art. 5º, XVI) a situações concretas: aviso prévio, autorização, armas, local.",
          level: "intermediate",
          name: "Direito de reunião",
          usedSituations: [
            "Moradores de um bairro marcaram uma reunião pacífica em uma praça pública, sem armas, e avisaram a prefeitura com antecedência.",
            "Um grupo quer se reunir em praça pública sem pedir autorização ao poder público.",
          ],
        },
        {
          description:
            "Reconhecer quando cabe habeas data (art. 5º, LXXII) e distingui-lo do mandado de segurança.",
          level: "intermediate",
          name: "Habeas data",
          usedSituations: [
            "Uma pessoa pediu ao órgão público acesso aos próprios dados cadastrais e teve o pedido negado.",
          ],
        },
        {
          description:
            "Reconhecer quando cabe mandado de segurança (art. 5º, LXIX) e seus requisitos.",
          level: "intermediate",
          name: "Mandado de segurança",
        },
      ],
    },
  },
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
    // Pedro's phase challenge (13 Oct 2026) showed "40000000 ações … 12500": placement writes the
    // challenge's questions, so code checks every number for the language's format.
    expectations: `Placement questions in Brazilian Portuguese for three ENEM skills about large quantities and decimals, each skill with one ENEM-style multiple-choice question (short support text, a command, 5 options, distractors from typical mistakes) and one typed question with checkable key points. Every number is written the Brazilian way: thousands grouped with a dot (12.500; 40.000.000 or 40 milhões), a decimal comma (3,5; 0,03%), money as R$ 1.250,00, and never a run of digits such as 40000000 or 12500. Options that are values use the same format as the text. Each question tests only its own skill, a skill's two questions use different situations, and the typed question doesn't give away the multiple-choice one's answer.`,
    id: "pt-enem-placement-large-numbers",
    userInput: {
      ...PLACEMENT_COUNTS,
      examFormat: ENEM,
      language: "pt",
      quickFormat: "multipleChoice",
      skills: [
        {
          description:
            "Calcular que porcentagem uma parte representa de um total na casa dos milhares ou dos milhões.",
          level: "intermediate",
          name: "Porcentagem de uma parte em um total grande",
        },
        {
          description:
            "Ler, escrever e comparar números na casa dos milhões e dos bilhões, como populações e orçamentos públicos.",
          level: "beginner",
          name: "Leitura e comparação de números grandes",
        },
        {
          description:
            "Calcular valores por pessoa, como gasto ou consumo per capita, dividindo um total grande pela população e arredondando o resultado.",
          level: "intermediate",
          name: "Valores per capita com decimais",
        },
      ],
    },
  },
  {
    // Helena's placement (ENEM, Oct 2026): a sound answer to "what check would you recommend?" was
    // graded wrong for not naming elimination, a second technique its key points demanded.
    expectations: `Placement questions in Brazilian Portuguese for one ENEM test-taking skill: one ENEM-style multiple-choice question and one typed question with checkable key points, both set in a situation during the exam. The typed question asks how to handle a question in the exam, and its key points say what any sound answer does: a question asking for a check or a strategy accepts any sound one, so no key point demands one particular technique among several (eliminating options, rereading the command, skipping and coming back) on top of another that does the same job. The test-taking skill is about scoring well (time, choosing between close options), never the exam day's procedures.`,
    id: "pt-enem-placement-test-taking",
    userInput: {
      ...PLACEMENT_COUNTS,
      examFormat: ENEM,
      language: "pt",
      quickFormat: "multipleChoice",
      skills: [
        {
          description:
            "Decidir entre alternativas próximas e administrar o tempo de uma questão difícil durante a prova.",
          level: "intermediate",
          name: "Decidir entre alternativas e administrar o tempo",
        },
      ],
    },
  },
  {
    // Bia's placement (ENEM, 10 Oct 2026): she picked Spanish of the exam's foreign language
    // choice, so placement asked its two skills; the questions written then were sound.
    expectations: `Placement questions in Brazilian Portuguese for two skills of ENEM's foreign language test in Spanish, the option the learner picked of the exam's choice. As in ENEM, each question's support text is in Spanish (a notice, a chronicle, a website, an ad, a song or another real genre), while the setup, the command, the options, the reasons and the typed question's key points are in Brazilian Portuguese. Never English, never a text-free grammar or translation drill, and never a question a reader of Portuguese could answer without understanding the Spanish (distractors come from real misreadings: false friends such as "apenas", "exquisito" or "embarazada", a detail read in isolation, a cognate taken at face value). Check every key against the Spanish text. Each skill has one ENEM-style multiple-choice question with 5 options and one typed question answered in Portuguese with checkable key points; a skill's two questions use different texts.`,
    id: "pt-enem-placement-spanish-option",
    userInput: {
      ...PLACEMENT_COUNTS,
      examFormat: ENEM,
      language: "pt",
      quickFormat: "multipleChoice",
      skills: [
        {
          description:
            "Usar vocabulário, expressões e estruturas linguísticas para entender o tema e a função de textos em espanhol.",
          level: "intermediate",
          name: "Interpretar vocabulário e estruturas de textos em espanhol",
        },
        {
          description:
            "Usar o espanhol para obter informações e conhecer tecnologias e culturas em textos de diferentes fontes.",
          level: "intermediate",
          name: "Usar o espanhol para acessar informações e culturas",
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
    // A mock's questions (mock-questions-workflow): one format, several per skill, no typed ones.
    expectations: `Mock exam questions in Brazilian Portuguese for two ENEM skills: exactly two ENEM-style multiple-choice questions per skill (short support text, a command, 5 options, distractors from typical mistakes) and no typed questions. Each skill lists the situations its questions in the bank already use (USED_SITUATIONS): no new question uses one of them again with other names, places or numbers, and a skill's two new questions differ from each other in situation and in what they ask. Each question tests only its own skill and reads like a real ENEM question at its level. The math must be right.`,
    id: "pt-enem-mock-quick-only",
    userInput: {
      examFormat: ENEM,
      language: "pt",
      quickCount: 2,
      quickFormat: "multipleChoice",
      skills: [
        {
          description:
            "Calcular o efeito de aumentos e descontos percentuais aplicados um após o outro.",
          level: "intermediate",
          name: "Aumentos e descontos percentuais sucessivos",
          usedSituations: [
            "Uma loja aumentou o preço de um produto em 10% e, no mês seguinte, deu 10% de desconto.",
          ],
        },
        {
          description:
            "Calcular a energia que um aparelho doméstico consome a partir da potência e do tempo de uso, e quanto isso custa.",
          level: "intermediate",
          name: "Consumo de energia elétrica em casa",
          usedSituations: [
            "Um chuveiro elétrico de 5.500 W é usado 30 minutos por dia durante um mês.",
          ],
        },
      ],
      typedCount: 0,
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
  {
    expectations: `Placement questions for a Brazilian learning US English for a job interview in Toronto, three situation skills at B1 to B2 (intermediate). Every question practices English itself: what the learner reads, chooses or writes as the language (the interviewer's line, the reply options, the typed answer) is in natural US English at about B1 to B2, while the setup, the question, reasons and feedback are in Brazilian Portuguese. Never a question about interview manners or steps that a learner could answer without knowing English, and never a question written entirely in Portuguese. Each skill also has one typed question whose answer is written in English, with key points saying what it must express. Situations are a data analyst's interview, varied, without the learner's own name.`,
    id: "pt-en-language-interview-placement",
    userInput: {
      ...PLACEMENT_COUNTS,
      language: "pt",
      quickFormat: "multipleChoice",
      skills: [
        {
          description:
            "Cumprimentar o entrevistador, apresentar-se e conduzir os primeiros minutos da conversa.",
          level: "intermediate",
          name: "Iniciar uma entrevista de emprego",
        },
        {
          description:
            "Pedir para repetir, reformular ou falar mais devagar sem perder a confiança.",
          level: "intermediate",
          name: "Pedir esclarecimentos na entrevista",
        },
        {
          description: "Contar um projeto de dados com o problema, o que você fez e o resultado.",
          level: "intermediate",
          name: "Apresentar um projeto de dados",
        },
      ],
      targetLanguage: "en",
    },
  },
];

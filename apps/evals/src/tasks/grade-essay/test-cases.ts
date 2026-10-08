import { type TestCase } from "@/lib/types";
import {
  type EnemInterventionElements,
  type EssayGrade,
  type GradeEssayParams,
} from "@zoonk/ai/tasks/v2/grading/grade-essay";
import { AP_ANSWERS, ENEM_ESSAYS, OTHER_ESSAYS } from "./essays";

type GradeEssayInput = Omit<GradeEssayParams, "model" | "useFallback" | "reasoning">;

/**
 * What a trained examiner would give, as a band for the estimated total, the
 * criteria a teacher would accept as the one to work on next, and the ENEM
 * proposal elements that must be read correctly.
 */
export type GradeEssayExpected = {
  totalBand: { min: number; max: number };
  nextStepCriteria: string[];
  zeroReason: EssayGrade["zeroReason"];
  feedbackLanguage: "en" | "pt";
  interventionElements?: Partial<EnemInterventionElements>;
};

const VACCINE_PROMPT = `Tema: Desafios para combater a desinformação sobre vacinas no Brasil.
Texto I: A cobertura vacinal infantil caiu no Brasil na última década, e doenças antes controladas voltaram a preocupar as autoridades de saúde.
Texto II: Boatos sobre supostos riscos das vacinas circulam mais depressa em aplicativos de mensagem do que as informações oficiais.
Texto III: Criado em 1973, o Programa Nacional de Imunizações oferece gratuitamente dezenas de vacinas e é reconhecido internacionalmente.
Redija um texto dissertativo-argumentativo em modalidade escrita formal da língua portuguesa, com proposta de intervenção que respeite os direitos humanos.`;

const FOOD_WASTE_PROMPT = `Tema: Caminhos para reduzir o desperdício de alimentos no Brasil.
Texto I: Uma parte expressiva dos alimentos produzidos no mundo se perde entre a colheita e o prato do consumidor.
Texto II: Supermercados e restaurantes descartam produtos próprios para consumo por receio de responsabilização.
Redija um texto dissertativo-argumentativo em modalidade escrita formal da língua portuguesa, com proposta de intervenção que respeite os direitos humanos.`;

const READING_PROMPT = `Tema: Caminhos para ampliar o hábito de leitura entre os jovens brasileiros.
Texto I: Pesquisas indicam que boa parte dos brasileiros não leu nenhum livro inteiro nos últimos meses.
Texto II: Muitos municípios não têm biblioteca pública em funcionamento regular.
Redija um texto dissertativo-argumentativo em modalidade escrita formal da língua portuguesa, com proposta de intervenção que respeite os direitos humanos.`;

const MOBILITY_PROMPT = `Tema: Desafios da mobilidade urbana nas grandes cidades brasileiras.
Texto I: Trabalhadores das regiões metropolitanas passam, em média, horas por semana no trânsito.
Texto II: O transporte coletivo concentra reclamações sobre lotação, atrasos e tarifas.
Redija um texto dissertativo-argumentativo em modalidade escrita formal da língua portuguesa, com proposta de intervenção que respeite os direitos humanos.`;

const LAI_PROMPT = `Redija um texto dissertativo acerca da Lei de Acesso à Informação (Lei n.º 12.527/2011). Ao elaborar seu texto, aborde os seguintes aspectos:
1 a diferença entre transparência ativa e transparência passiva;
2 os prazos para a resposta a um pedido de acesso;
3 a classificação de informações sigilosas e os prazos máximos de restrição de acesso.`;

const LAI_KEY_POINTS = [
  "Transparência ativa: os órgãos divulgam informações de interesse coletivo independentemente de requerimento (art. 8º); transparência passiva: atendimento a pedidos de acesso de qualquer interessado (art. 10)",
  "Acesso imediato; não sendo possível, prazo de até 20 dias, prorrogável por mais 10 dias mediante justificativa expressa (art. 11)",
  "Graus de sigilo: ultrassecreta até 25 anos, secreta até 15 anos e reservada até 5 anos (art. 24, § 1º)",
];

const IELTS_PROMPT = `IELTS Academic Writing Task 2. Write at least 250 words.
Some people believe that university education should be free for all students, while others think students should pay for their own studies. Discuss both views and give your own opinion.`;

const OAB_PROMPT = `Joana Martins, solteira, professora, residente em Belo Horizonte/MG, comprou em 5 de março de 2026, na loja Casa Fria Eletrodomésticos Ltda., com sede em Belo Horizonte/MG, uma geladeira nova por R$ 4.000,00. Vinte dias depois, o aparelho parou de refrigerar. Em 26 de março, Joana levou o produto à assistência técnica indicada pela loja e, até 15 de maio, o vício não havia sido sanado. A loja se recusa a trocar o produto ou a devolver o valor pago, alegando que a responsabilidade é exclusiva do fabricante. Joana perdeu alimentos no valor de R$ 600,00, comprovados por notas fiscais.
Na qualidade de advogado(a) de Joana, que deseja receber de volta o valor pago e ser indenizada pelo prejuízo, sem recorrer ao Juizado Especial, elabore a peça processual cabível. (Valor: 5,00)`;

const OAB_KEY_POINTS = [
  "Endereçamento ao Juízo da Vara Cível da Comarca de Belo Horizonte/MG, foro do domicílio da consumidora (art. 101, I, do CDC)",
  "Partes: Joana Martins (autora) e Casa Fria Eletrodomésticos Ltda. (ré)",
  "Breve exposição dos fatos",
  "Relação de consumo: consumidora e fornecedora (arts. 2º e 3º do CDC)",
  "Responsabilidade solidária do comerciante pelo vício do produto (art. 18, caput, do CDC), afastando a alegação de responsabilidade exclusiva do fabricante",
  "Vício não sanado em 30 dias: restituição imediata da quantia paga, monetariamente atualizada, sem prejuízo de perdas e danos (art. 18, § 1º, II, do CDC)",
  "Danos materiais pelos alimentos perdidos (art. 6º, VI, do CDC)",
  "Inversão do ônus da prova (art. 6º, VIII, do CDC)",
  "Pedidos: citação da ré, opção pela audiência de conciliação, inversão do ônus da prova, restituição de R$ 4.000,00 atualizados, indenização de R$ 600,00, custas e honorários, produção de provas",
  "Valor da causa de R$ 4.600,00 (art. 292, VI, do CPC); local, data, advogado e OAB",
];

const AP_BIOLOGY_PROMPT = `AP Biology, free-response question (original practice question).
A student measures the rate of an enzyme-catalyzed reaction at 20 °C, 30 °C, 40 °C, 45 °C and 55 °C, keeping the enzyme and substrate concentrations the same. The rate rises from 20 °C to a maximum at 40 °C, then falls sharply at 45 °C and 55 °C.
(a) Identify the independent variable in the investigation.
(b) Describe the trend in the rate of the reaction between 20 °C and 40 °C.
(c) Explain why the rate of the reaction decreases above 45 °C.
(d) Predict the effect on the rate of adding a competitive inhibitor at 37 °C, and justify your prediction.`;

const AP_BIOLOGY_RUBRIC = [
  {
    criterion: "(a) Independent variable",
    description: "Identifies temperature as the independent variable.",
    points: 1,
  },
  {
    criterion: "(b) Trend",
    description: "Describes that the rate increases from 20 °C to 40 °C.",
    points: 1,
  },
  {
    criterion: "(c) Explanation",
    description:
      "1 point for explaining that high temperature denatures the enzyme (changes its shape); 1 point for linking the changed active site to the substrate no longer binding.",
    points: 2,
  },
  {
    criterion: "(d) Prediction and justification",
    description:
      "1 point for predicting that the rate decreases; 1 point for justifying that the inhibitor competes with the substrate for the active site.",
    points: 2,
  },
];

const AP_HISTORY_PROMPT = `AP United States History, long essay question (original practice question). Evaluate the extent to which the expansion of the railroads changed the economy of the United States in the period from 1865 to 1900.`;

const AP_HISTORY_RUBRIC = [
  {
    criterion: "Thesis",
    description:
      "Responds to the prompt with a historically defensible claim that establishes a line of reasoning.",
    points: 1,
  },
  {
    criterion: "Contextualization",
    description:
      "Describes a broader historical context relevant to the prompt, before, during or continuing after the period.",
    points: 1,
  },
  {
    criterion: "Evidence",
    description:
      "1 point for providing two specific examples of evidence relevant to the prompt; 2 points for using specific and relevant evidence to support an argument in response to the prompt.",
    points: 2,
  },
  {
    criterion: "Analysis and reasoning",
    description:
      "1 point for using historical reasoning (causation, comparison or continuity and change) to frame or structure an argument; 2 points for demonstrating a complex understanding, such as explaining multiple causes or effects, both change and continuity, or nuance by analyzing multiple variables.",
    points: 2,
  },
];

const ALL_ENEM_ELEMENTS = { action: true, agent: true, detail: true, effect: true, means: true };

export const TEST_CASES: TestCase<GradeEssayExpected, GradeEssayInput>[] = [
  {
    expected: {
      feedbackLanguage: "pt",
      interventionElements: ALL_ENEM_ELEMENTS,
      nextStepCriteria: ["c1", "c2", "c3", "c4"],
      totalBand: { max: 1000, min: 840 },
      zeroReason: null,
    },
    id: "enem-strong-pt",
    userInput: {
      essay: ENEM_ESSAYS.strongVaccines,
      language: "pt",
      prompt: VACCINE_PROMPT,
      rubric: { kind: "enem" },
    },
  },
  {
    expected: {
      feedbackLanguage: "pt",
      interventionElements: { action: true, agent: true, effect: true, means: false },
      nextStepCriteria: ["c2", "c3", "c5"],
      totalBand: { max: 760, min: 600 },
      zeroReason: null,
    },
    id: "enem-mid-missing-means-pt",
    userInput: {
      essay: ENEM_ESSAYS.midFoodWaste,
      language: "pt",
      prompt: FOOD_WASTE_PROMPT,
      rubric: { kind: "enem" },
    },
  },
  {
    expected: {
      feedbackLanguage: "pt",
      nextStepCriteria: ["c1"],
      totalBand: { max: 600, min: 320 },
      zeroReason: null,
    },
    id: "enem-weak-norm-errors-pt",
    userInput: {
      essay: ENEM_ESSAYS.weakReading,
      language: "pt",
      prompt: READING_PROMPT,
      rubric: { kind: "enem" },
    },
  },
  {
    expected: {
      feedbackLanguage: "pt",
      nextStepCriteria: ["c2"],
      totalBand: { max: 0, min: 0 },
      zeroReason: "offTopic",
    },
    id: "enem-off-topic-pt",
    userInput: {
      essay: ENEM_ESSAYS.offTopicSocialMedia,
      language: "pt",
      prompt: MOBILITY_PROMPT,
      rubric: { kind: "enem" },
    },
  },
  {
    expected: {
      feedbackLanguage: "en",
      interventionElements: { action: true, agent: true, effect: true, means: false },
      nextStepCriteria: ["c2", "c3", "c5"],
      totalBand: { max: 760, min: 600 },
      zeroReason: null,
    },
    id: "enem-mid-missing-means-feedback-en",
    userInput: {
      essay: ENEM_ESSAYS.midFoodWaste,
      language: "en",
      prompt: FOOD_WASTE_PROMPT,
      rubric: { kind: "enem" },
    },
  },
  {
    expected: {
      feedbackLanguage: "pt",
      nextStepCriteria: ["c2"],
      totalBand: { max: 0, min: 0 },
      zeroReason: "tooShort",
    },
    id: "enem-too-short-pt",
    userInput: {
      essay: ENEM_ESSAYS.tooShortMobility,
      language: "pt",
      prompt: MOBILITY_PROMPT,
      rubric: { kind: "enem" },
    },
  },
  {
    expected: {
      feedbackLanguage: "pt",
      nextStepCriteria: ["criterion-4"],
      totalBand: { max: 17.5, min: 11 },
      zeroReason: null,
    },
    id: "cebraspe-discursive-lai-pt",
    userInput: {
      essay: OTHER_ESSAYS.cebraspeLai,
      keyPoints: LAI_KEY_POINTS,
      language: "pt",
      prompt: LAI_PROMPT,
      rubric: {
        criteria: [
          {
            criterion: "Apresentação e estrutura textual",
            description:
              "Texto dissertativo organizado em introdução, desenvolvimento e conclusão, com parágrafos, clareza e correção gramatical",
          },
          {
            criterion: "Aspecto 1: transparência ativa e passiva",
            description: LAI_KEY_POINTS[0] ?? "",
          },
          { criterion: "Aspecto 2: prazos de resposta", description: LAI_KEY_POINTS[1] ?? "" },
          { criterion: "Aspecto 3: sigilo e prazos", description: LAI_KEY_POINTS[2] ?? "" },
        ],
        kind: "custom",
        maxScore: 20,
      },
    },
  },
  {
    expected: {
      feedbackLanguage: "en",
      nextStepCriteria: ["criterion-1"],
      totalBand: { max: 26, min: 18 },
      zeroReason: null,
    },
    id: "ielts-task-2-free-university-en",
    userInput: {
      essay: OTHER_ESSAYS.ieltsFreeUniversity,
      language: "en",
      prompt: IELTS_PROMPT,
      rubric: {
        criteria: [
          {
            criterion: "Task Response",
            description:
              "Band 0 to 9: addresses all parts of the task (both views and a clear opinion) with relevant, extended and supported ideas",
          },
          {
            criterion: "Coherence and Cohesion",
            description:
              "Band 0 to 9: logical organization, clear paragraphing and a range of cohesive devices used appropriately",
          },
          {
            criterion: "Lexical Resource",
            description:
              "Band 0 to 9: range and precision of vocabulary, collocation, spelling and word formation",
          },
          {
            criterion: "Grammatical Range and Accuracy",
            description:
              "Band 0 to 9: range of structures and how many sentences are free of grammar and punctuation errors",
          },
        ],
        kind: "custom",
        maxScore: 36,
      },
    },
  },
  {
    expected: {
      feedbackLanguage: "pt",
      nextStepCriteria: ["legal-basis"],
      totalBand: { max: 2.6, min: 0.8 },
      zeroReason: null,
    },
    id: "oab-peca-consumer-refund-pt",
    userInput: {
      essay: OTHER_ESSAYS.oabConsumerRefund,
      keyPoints: OAB_KEY_POINTS,
      language: "pt",
      prompt: OAB_PROMPT,
      rubric: { kind: "oab" },
    },
  },
  {
    expected: {
      feedbackLanguage: "en",
      nextStepCriteria: ["criterion-3", "criterion-4"],
      totalBand: { max: 4, min: 3 },
      zeroReason: null,
    },
    id: "ap-biology-frq-partial-en",
    userInput: {
      essay: AP_ANSWERS.biologyEnzymes,
      language: "en",
      prompt: AP_BIOLOGY_PROMPT,
      rubric: { criteria: AP_BIOLOGY_RUBRIC, kind: "ap" },
    },
  },
  {
    expected: {
      feedbackLanguage: "pt",
      nextStepCriteria: ["criterion-4"],
      totalBand: { max: 6, min: 4 },
      zeroReason: null,
    },
    id: "ap-us-history-leq-railroads-feedback-pt",
    userInput: {
      essay: AP_ANSWERS.historyRailroads,
      language: "pt",
      prompt: AP_HISTORY_PROMPT,
      rubric: { criteria: AP_HISTORY_RUBRIC, kind: "ap" },
    },
  },
];

import { type TestCase } from "@/lib/types";
import { type WritingPromptInput } from "@zoonk/ai/tasks/items/write-writing-prompt";
import { cguWritingGrading } from "../_fixtures/cgu-writing-grading";

/** A written task as the notice reading lists it, which the app sends whole. */
type WrittenTask = WritingPromptInput["task"];
export type WriteWritingPromptInput = WritingPromptInput;

const SKILLS = {
  plan: {
    id: "0195f1d2-7c4a-7d3e-9a10-000000000001",
    name: "Planejar respostas discursivas fundamentadas",
  },
  revise: { id: "0195f1d2-7c4a-7d3e-9a10-000000000003", name: "Revisar respostas discursivas" },
  write: {
    id: "0195f1d2-7c4a-7d3e-9a10-000000000002",
    name: "Redigir respostas discursivas sobre controle público",
  },
};

const CGU_SKILLS = [SKILLS.plan, SKILLS.write, SKILLS.revise];

const CGU_QUESTION: WrittenTask = {
  count: 1,
  description:
    "uma questão discursiva, relacionada a conhecimentos complementares, a ser respondida em até 30 linhas, no valor de 30,00 pontos",
  grading: cguWritingGrading({
    factor: 6,
    formula: "NQ1 = NC - 6 × NE ÷ TL",
    item: "9.7.5",
    total: 30,
  }),
  handwritten: true,
  key: "written-cgu-q1",
  lines: 30,
  minutes: 210,
  points: 30,
  section: "Prova discursiva (P4)",
  session: "no turno da tarde",
};

const CGU_CASE: WrittenTask = {
  count: 1,
  description:
    "uma questão envolvendo situação-problema, relacionada a conhecimentos específicos do cargo/especialidade, a ser respondida em até 60 linhas, no valor de 70,00 pontos",
  grading: cguWritingGrading({
    factor: 14,
    formula: "NQ2 = NC – 14 × NE ÷ TL",
    item: "9.7.6",
    total: 70,
  }),
  handwritten: true,
  key: "written-cgu-q2",
  lines: 60,
  minutes: 210,
  points: 70,
  section: "Prova discursiva (P4) – Auditoria e Controle",
  session: "no turno da tarde",
};

const ENEM_REDACAO: WrittenTask = {
  count: 1,
  description:
    "uma redação em Língua Portuguesa, texto dissertativo-argumentativo, com nota entre 0 e 1.000 pontos",
  grading: {
    criteria: [],
    kind: "enem",
    language: null,
    rounding: null,
    zeroing: [
      {
        citation: {
          passage:
            "14.7 A banca avaliadora poderá atribuir nota 0 (zero) à redação que: 14.7.1 Não atender à proposta solicitada ou possua outra estrutura textual que não seja a estrutura dissertativo-argumentativa",
          sourceId: "enem-2026-edital-64",
        },
        text: "Fuga ao tema/não atendimento à estrutura dissertativo-argumentativa",
      },
    ],
  },
  handwritten: true,
  key: "written-enem-redacao",
  lines: null,
  minutes: null,
  points: 1000,
  section: "Linguagens, Códigos e suas Tecnologias e Redação",
  session: null,
};

const OAB_PECA: WrittenTask = {
  count: 1,
  description:
    "Redação de peça profissional de Direito Penal e do seu correspondente direito processual, valendo 5,00 pontos",
  grading: {
    criteria: [
      {
        citation: {
          passage:
            "3.5.11. O texto da peça profissional e as respostas às questões discursivas serão avaliados quanto à adequação ao problema apresentado",
          sourceId: "oab-47-edital",
        },
        id: "fit",
        points: null,
        text: "adequação ao problema apresentado",
      },
      {
        citation: {
          passage:
            "3.5.11. … ao domínio do raciocínio jurídico, à fundamentação e sua consistência",
          sourceId: "oab-47-edital",
        },
        id: "reasoning",
        points: null,
        text: "domínio do raciocínio jurídico, fundamentação e sua consistência",
      },
      {
        citation: {
          passage:
            "3.5.11. … à capacidade de interpretação e exposição e à técnica profissional demonstrada",
          sourceId: "oab-47-edital",
        },
        id: "technique",
        points: null,
        text: "capacidade de interpretação e exposição e técnica profissional",
      },
    ],
    kind: "oab",
    language: null,
    rounding: {
      citation: {
        passage:
          "4.2.4.1. … o somatório dessas notas constituirá a nota na prova prático-profissional, vedado o arredondamento.",
        sourceId: "oab-47-edital",
      },
      text: "vedado o arredondamento",
    },
    zeroing: [
      {
        citation: {
          passage:
            "4.2.6. Nos casos de propositura de peça inadequada para a solução do problema proposto",
          sourceId: "oab-47-edital",
        },
        text: "peça inadequada para a solução do problema proposto",
      },
    ],
  },
  handwritten: true,
  key: "written-oab-peca",
  lines: null,
  minutes: 300,
  points: 5,
  section: "Prova prático-profissional (P2)",
  session: "das 13 às 18 horas",
};

const ESSAY_NO_SCALE: WrittenTask = {
  count: 1,
  description:
    "one essay of about 500 words on a question about the industrial revolution in Britain",
  grading: { criteria: [], kind: "levels", language: null, rounding: null, zeroing: [] },
  handwritten: null,
  key: "written-history-essay",
  lines: null,
  minutes: 45,
  points: null,
  section: "Paper 2: Written answer",
  session: null,
};

const HISTORY_SKILLS = [
  { id: "0195f1d2-7c4a-7d3e-9a10-000000000011", name: "Build a historical argument from evidence" },
  { id: "0195f1d2-7c4a-7d3e-9a10-000000000012", name: "Write a clear thesis for a history essay" },
  { id: "0195f1d2-7c4a-7d3e-9a10-000000000013", name: "Proofread a timed essay" },
];

const ANSWER_EXPECTATIONS = `A question the board could set for this task, on a topic inside the task's description and the skills' field, in the kind of text the task asks for. The question numbers the aspects to address and states the marks of each when the task has points; it doesn't restate the line limit or total. The keyed aspects are each one thing an examiner can see present or missing, split into steps where a board grades in steps, covering every requested aspect; every fact in the key points is correct and current, with its legal basis when an answer would cite one. The context, when present, invents nothing attributed to a real source. assessedSkillIds name only skills the answer exercises (never a revising or proofreading skill). The title names the topic in a few words.`;

export const TEST_CASES: TestCase<unknown, WriteWritingPromptInput>[] = [
  {
    expectations: `${ANSWER_EXPECTATIONS} The aspects' points add up to 30, and the topic is one a Cebraspe complementary-knowledge question for a federal audit career could set.`,
    id: "cgu-question-30-lines-pt",
    userInput: {
      board: "Cebraspe",
      drillSkillId: null,
      exam: "CGU Auditor Federal de Finanças e Controle",
      language: "pt",
      sectionTopics: ["Administração Financeira e Orçamentária", "Controle interno"],
      skills: CGU_SKILLS,
      task: CGU_QUESTION,
      unit: "answer",
      usedTitles: [],
    },
  },
  {
    expectations: `${ANSWER_EXPECTATIONS} The aspects' points add up to 70; the question is a situação-problema (a concrete case the candidate must analyze and resolve) for a federal audit and control career, not an abstract essay prompt.`,
    id: "cgu-case-60-lines-pt",
    userInput: {
      board: "Cebraspe",
      drillSkillId: null,
      exam: "CGU Auditor Federal de Finanças e Controle",
      language: "pt",
      sectionTopics: ["Auditoria governamental", "Controle interno"],
      skills: CGU_SKILLS,
      task: CGU_CASE,
      unit: "answer",
      usedTitles: [],
    },
  },
  {
    expectations: `${ANSWER_EXPECTATIONS} Its topic differs from every used title in substance, not only in wording (no other question on the access-to-information law, LGPD, public procurement or internal control lines of defense).`,
    id: "cgu-question-used-titles-pt",
    userInput: {
      board: "Cebraspe",
      drillSkillId: null,
      exam: "CGU Auditor Federal de Finanças e Controle",
      language: "pt",
      sectionTopics: ["Administração Financeira e Orçamentária", "Controle interno"],
      skills: CGU_SKILLS,
      task: CGU_QUESTION,
      unit: "answer",
      usedTitles: [
        "Lei de Acesso à Informação",
        "Transparência ativa e passiva",
        "LGPD no setor público",
        "Nova Lei de Licitações",
        "Três linhas de defesa",
        "Controle interno na administração",
      ],
    },
  },
  {
    expectations: `A drill: one short writing move (an outline, a thesis, one paragraph, a conclusion or a rewrite under a tighter limit) that practices planning a well-founded discursive answer, done in a few minutes. The context gives what the move works on; the question asks for that move only, with its length; the criteria assess only that move, with null points; assessedSkillIds holds only the drill skill.`,
    id: "cgu-drill-plan-pt",
    userInput: {
      board: "Cebraspe",
      drillSkillId: SKILLS.plan.id,
      exam: "CGU Auditor Federal de Finanças e Controle",
      language: "pt",
      sectionTopics: ["Administração Financeira e Orçamentária", "Controle interno"],
      skills: [SKILLS.plan],
      task: CGU_QUESTION,
      unit: "drill",
      usedTitles: ["Esboço sobre controle externo"],
    },
  },
  {
    expectations: `An ENEM redação proposal: a social theme stated as Inep states themes, two to four short motivating texts in the context that never attribute invented quotes or figures to real sources, and the command to write a dissertative-argumentative text in formal Portuguese with an intervention proposal that respects human rights. The criteria are the five competences with ids c1 to c5 and null points. Aspects name what earns credit on this theme (the exact theme, not only its broad subject; the proposal's agent, action, means, effect and detail).`,
    id: "enem-redacao-pt",
    userInput: {
      board: "Inep",
      drillSkillId: null,
      exam: "Enem",
      language: "pt",
      sectionTopics: [],
      skills: [
        {
          id: "0195f1d2-7c4a-7d3e-9a10-000000000021",
          name: "Redação dissertativo-argumentativa do Enem",
        },
      ],
      task: ENEM_REDACAO,
      unit: "answer",
      usedTitles: ["Herança africana no Brasil"],
    },
  },
  {
    expectations: `An OAB 2nd phase criminal-law peça: a case with dated facts and procedural stage from which exactly one correct peça follows, asking the candidate to draft it, with the key naming the right peça and its legal basis, the court, the theses with their provisions and the requests, each fact and article correct. The criteria keep the notice's three ids with null points. The question never invents personal data and expects placeholders for the lawyer.`,
    id: "oab-peca-penal-pt",
    userInput: {
      board: "FGV",
      drillSkillId: null,
      exam: "Exame de Ordem Unificado, segunda fase",
      language: "pt",
      sectionTopics: ["Direito do Trabalho", "Direito Processual do Trabalho"],
      skills: [
        { id: "0195f1d2-7c4a-7d3e-9a10-000000000031", name: "Redigir peças processuais penais" },
      ],
      task: OAB_PECA,
      unit: "answer",
      usedTitles: [],
    },
  },
  {
    expectations: `${ANSWER_EXPECTATIONS} The notice states no scale: two to five criteria of the examiner's own with null points, aspects with null points, and a question with no marks. A real exam-board style history essay question on the industrial revolution in Britain, in English.`,
    id: "history-essay-no-scale-en",
    userInput: {
      drillSkillId: null,
      exam: "Prova de redação",
      language: "en",
      sectionTopics: [],
      skills: HISTORY_SKILLS,
      task: ESSAY_NO_SCALE,
      unit: "answer",
      usedTitles: ["Factory conditions and reform"],
    },
  },
  {
    expectations: `A drill in English that practices writing a thesis for a history essay: the context gives an essay question (and nothing else long), the question asks only for a thesis sentence or two, the criteria assess that thesis only, with null points, and assessedSkillIds holds only the drill skill.`,
    id: "history-drill-thesis-en",
    userInput: {
      drillSkillId: HISTORY_SKILLS[1]?.id ?? null,
      exam: "Prova de redação",
      language: "en",
      sectionTopics: [],
      skills: HISTORY_SKILLS.slice(1, 2),
      task: ESSAY_NO_SCALE,
      unit: "drill",
      usedTitles: [],
    },
  },
];

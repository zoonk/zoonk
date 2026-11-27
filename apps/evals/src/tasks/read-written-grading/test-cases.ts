import { type TestCase } from "@/lib/types";
import { TEST_CASES as EXTRACTION_CASES } from "../extract-exam-blueprint/test-cases";
import { type WrittenGradingEvalInput } from "./generate";
import { type WrittenGradingExpected } from "./task";

type WrittenGradingCase = TestCase<WrittenGradingExpected, WrittenGradingEvalInput>;

/** The documents and exam of the blueprint case this reading follows. */
function readingOf(id: string): Pick<WrittenGradingEvalInput, "documents" | "exam"> {
  const found = EXTRACTION_CASES.find((testCase) => testCase.id === id);

  if (!found) {
    throw new Error(`No blueprint case ${id}.`);
  }

  return { documents: found.userInput.documents, exam: found.userInput.exam };
}

const ENEM_SCALE = [0, 40, 80, 120, 160, 200];

/** An invented mark scheme: two banded criteria added up, a cap and zero rules, no language deduction. */
const MARK_SCHEME = `NORTHFIELD SCHOOL-LEAVING CERTIFICATE 2027
ENGLISH – PAPER 2: WRITING
MARK SCHEME FOR SECTION B (EXTENDED ESSAY)

B1 Section B is one extended essay of at most 600 words, worth 30 marks.
B2 Examiners mark each essay on two criteria, Content and Organisation (20 marks) and Language (10 marks), and add the two marks.
B3 Content and Organisation:
Level 0 (0 marks): nothing worthy of credit.
Level 1 (1–5 marks): a few relevant ideas, loosely linked.
Level 2 (6–10 marks): relevant ideas with some development and a recognizable structure.
Level 3 (11–15 marks): well-developed ideas in clear paragraphs.
Level 4 (16–20 marks): a sustained, convincing response, skilfully organised.
B4 Language:
Level 0 (0 marks): nothing worthy of credit.
Level 1 (1–3 marks): simple vocabulary; frequent errors that obscure meaning.
Level 2 (4–7 marks): adequate vocabulary; errors rarely obscure meaning.
Level 3 (8–10 marks): precise, varied vocabulary and sentence forms; few errors.
B5 An essay that does not answer the question set may score at most 5 marks for Content and Organisation.
B6 A blank script, or an essay on a topic other than the one set, receives 0 marks.
B7 Examiners do not take marks off for handwriting.`;

export const TEST_CASES: WrittenGradingCase[] = [
  {
    expected: {
      "2.1": {
        combination: null,
        criterionPoints: [30],
        language: { factor: 6, method: "errorsPerLine" },
        rounding: true,
        scales: [null],
        total: true,
        zeroKinds: ["blank", "offTopic"],
      },
      "2.2": {
        combination: null,
        criterionPoints: [70],
        language: { factor: 14, method: "errorsPerLine" },
        rounding: true,
        scales: [null],
        total: true,
        zeroKinds: ["blank", "offTopic"],
      },
    },
    id: "cgu-2026-two-questions-pt",
    userInput: {
      ...readingOf("cgu-2026-affc-ti-points"),
      tasks: [
        {
          description:
            "uma questão discursiva, relacionada a conhecimentos complementares, a ser respondida em até 30 linhas, no valor de 30,00 pontos",
          id: "2.1",
          lines: 30,
          points: 30,
          section: "Prova discursiva",
        },
        {
          description:
            "uma questão envolvendo situação-problema, relacionada a conhecimentos específicos do cargo/especialidade, a ser respondida em até 60 linhas, no valor de 70,00 pontos",
          id: "2.2",
          lines: 60,
          points: 70,
          section: "Prova discursiva",
        },
      ],
    },
  },
  {
    expected: {
      "2.1": {
        scales: Array.from({ length: 5 }, () => ENEM_SCALE),
        total: true,
        zeroKinds: ["blank", "offTopic", "tooFewLines", "wrongForm"],
      },
    },
    id: "enem-2026-redacao-pt",
    userInput: {
      ...readingOf("enem-2026"),
      tasks: [
        {
          description:
            "Texto dissertativo-argumentativo em modalidade escrita formal da língua portuguesa sobre tema proposto",
          id: "2.1",
          lines: 30,
          points: 1000,
          section: "1º dia",
        },
      ],
    },
  },
  {
    expected: {
      /** Each factual error takes a point off one criterion, which no sheet field holds. */
      "1.1": { criteriaTotal: 35, limits: 1, total: false, zeroing: true },
    },
    id: "matura-2025-polski-wypracowanie-pl",
    language: "pl",
    userInput: {
      ...readingOf("matura-2025-polski-rozszerzony-scoring-rules"),
      tasks: [
        {
          description:
            "Wypowiedź argumentacyjna na jeden z wybranych tematów o długości co najmniej 400 wyrazów",
          id: "1.1",
          lines: null,
          points: 35,
          section: "Wypracowanie",
        },
      ],
    },
  },
  {
    expected: {
      "1.1": {
        criterionPoints: [5],
        language: null,
        rounding: false,
        scales: [null],
        total: true,
        zeroKinds: ["blank", "offTopic", "wrongForm"],
        zeroing: true,
      },
      "1.2": { criterionPoints: [1.25], total: true },
    },
    id: "oab-47-peca-and-questions-pt",
    userInput: {
      ...readingOf("oab-47-2a-fase-written"),
      tasks: [
        {
          description:
            "Redação de peça profissional acerca de tema da área jurídica de opção do examinando e do seu correspondente direito processual",
          id: "1.1",
          lines: null,
          points: 5,
          section: "Prova prático-profissional",
        },
        {
          description:
            "Questões discursivas sob a forma de situações-problema relativas à área de opção do examinando e do seu correspondente direito processual",
          id: "1.2",
          lines: 30,
          points: 1.25,
          section: "Prova prático-profissional",
        },
      ],
    },
  },
  {
    expected: { "2.1": { criterionPoints: [], language: null, total: false, zeroing: false } },
    id: "municipal-notice-no-marking-pt",
    userInput: {
      ...readingOf("municipal-notice-written-no-scale"),
      tasks: [
        {
          description:
            "redação de um texto dissertativo sobre tema de atualidade relacionado à administração pública municipal",
          id: "2.1",
          lines: 30,
          points: null,
          section: "Provas objetiva e discursiva",
        },
      ],
    },
  },
  {
    expected: {
      "1.1": {
        combination: "sum",
        criterionPoints: [20, 10],
        language: null,
        limits: 1,
        scales: [
          [0, 1, 6, 11, 16],
          [0, 1, 4, 8],
        ],
        total: true,
        zeroKinds: ["blank", "offTopic"],
      },
    },
    id: "invented-mark-scheme-banded-essay-en",
    userInput: {
      documents: [{ text: MARK_SCHEME, title: "Paper 2 mark scheme, Section B" }],
      exam: "Northfield School-Leaving Certificate, English",
      tasks: [
        {
          description: "one extended essay of at most 600 words",
          id: "1.1",
          lines: null,
          points: 30,
          section: "Paper 2: Writing, Section B",
        },
      ],
    },
  },
];
